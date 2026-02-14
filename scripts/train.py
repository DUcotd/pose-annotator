import argparse
import sys
import os
import json
import time
import signal
import threading
import psutil

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

from ultralytics import YOLO

PARENT_PID = os.getppid()
CHECK_INTERVAL = 10
should_stop = False

def log_json(data):
    print(f"__JSON_LOG__{json.dumps(data)}", flush=True)

def check_parent_alive():
    """定期检查父进程是否存活，如果父进程已退出则自动终止自身"""
    global should_stop
    try:
        if PARENT_PID == 1:
            print("⚠️ 父进程为 init (PID=1)，假设父进程已退出", flush=True)
            should_stop = True
            return False
        
        try:
            parent = psutil.Process(PARENT_PID)
            if not parent.is_running():
                print(f"⚠️ 父进程 (PID={PARENT_PID}) 不再运行，正在退出...", flush=True)
                should_stop = True
                return False
        except psutil.NoSuchProcess:
            print(f"⚠️ 父进程 (PID={PARENT_PID}) 不存在，正在退出...", flush=True)
            should_stop = True
            return False
        except psutil.AccessDenied:
            pass
            
        return True
    except Exception as e:
        print(f"⚠️ 检查父进程状态时出错: {e}", flush=True)
        return True

def parent_monitor_thread():
    """后台线程：定期检查父进程是否存活"""
    global should_stop
    print(f"🔄 父进程监控线程已启动 (父进程 PID: {PARENT_PID}, 检查间隔: {CHECK_INTERVAL}s)", flush=True)
    
    while not should_stop:
        time.sleep(CHECK_INTERVAL)
        if should_stop:
            break
        if not check_parent_alive():
            log_json({
                "event": "parent_exit",
                "message": "父进程已退出，训练即将停止"
            })
            break
    
    print("🔄 父进程监控线程已退出", flush=True)

def signal_handler(signum, frame):
    """处理终止信号"""
    global should_stop
    print(f"收到信号 {signum}，正在停止训练...", flush=True)
    should_stop = True

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

ERROR_MAPPINGS = {
    "cuda": {
        "keywords": ["cuda", "CUDA", "GPU", "gpu device"],
        "type": "hardware",
        "title": "GPU 相关错误",
        "suggestions": [
            "请确认已正确安装 NVIDIA 显卡驱动",
            "检查 PyTorch 是否支持 CUDA",
            "尝试将 device 参数改为 'cpu' 使用 CPU 模式训练"
        ]
    },
    "cuda_oom": {
        "keywords": ["out of memory", "OOM", "CUDA out of memory", "RuntimeError: CUDA out of memory"],
        "type": "oom",
        "title": "显存不足 (OOM)",
        "suggestions": [
            "减小 batch_size 参数（当前值可能过大）",
            "减小 imgsz 图片尺寸",
            "尝试使用更小的模型（如 yolov8n 或 yolov8s）",
            "开启混合精度训练可减少显存占用"
        ]
    },
    "cudnn": {
        "keywords": ["cudnn", "CUDNN", "cuDNN"],
        "type": "cudnn",
        "title": "cuDNN 错误",
        "suggestions": [
            "可能是 CUDA 版本与 cuDNN 不匹配",
            "尝试更新 NVIDIA 驱动到最新版本",
            "或设置环境变量 CUDA_LAUNCH_BLOCKING=1 获取更多调试信息"
        ]
    },
    "torch_cuda": {
        "keywords": ["torch.cuda", "torch is not able to use GPU"],
        "type": "torch_cuda",
        "title": "PyTorch 无法使用 GPU",
        "suggestions": [
            "确认 PyTorch 已正确安装 CUDA 版本",
            "执行 python -c \"import torch; print(torch.cuda.is_available())\" 检查",
            "尝试重新安装 PyTorch: pip install torch --index-url https://download.pytorch.org/whl/cu118"
        ]
    },
    "no_gpu": {
        "keywords": ["No CUDA GPUs are available", "No GPU detected"],
        "type": "no_gpu",
        "title": "未检测到可用 GPU",
        "suggestions": [
            "请确认电脑已安装 NVIDIA 显卡",
            "检查显卡驱动是否正确安装",
            "在设备管理器中确认显卡未被禁用",
            "可使用 device: 'cpu' 使用 CPU 进行训练"
        ]
    },
    "memory": {
        "keywords": ["MemoryError", "cannot allocate memory", "Unable to allocate"],
        "type": "memory",
        "title": "内存不足",
        "suggestions": [
            "系统内存不足，尝试关闭其他程序",
            "减小 batch_size 参数",
            "检查是否有内存泄漏"
        ]
    }
}

def detect_hardware():
    """轻量级硬件环境检测模块，验证 GPU 可用性"""
    print("🔍 正在检测硬件环境...", flush=True)
    
    result = {
        "available": False,
        "gpu_count": 0,
        "gpu_name": None,
        "cuda_version": None,
        "torch_cuda_version": None,
        "errors": []
    }
    
    try:
        import torch
        result["torch_cuda_version"] = torch.version.cuda if torch.version.cuda else None
        
        if torch.cuda.is_available():
            result["available"] = True
            result["gpu_count"] = torch.cuda.device_count()
            result["gpu_name"] = torch.cuda.get_device_name(0) if result["gpu_count"] > 0 else None
            result["cuda_version"] = torch.version.cuda
            
            total_memory = torch.cuda.get_device_properties(0).total_memory / (1024**3)
            result["total_memory_gb"] = round(total_memory, 2)
            
            print(f"✅ 检测到 {result['gpu_count']} 个 GPU", flush=True)
            print(f"   GPU 0: {result['gpu_name']}", flush=True)
            print(f"   CUDA 版本: {result['cuda_version']}", flush=True)
            print(f"   显存总量: {result['total_memory_gb']} GB", flush=True)
        else:
            result["errors"].append("CUDA 不可用")
            print("⚠️ CUDA 不可用，将使用 CPU 模式", flush=True)
            
    except ImportError:
        result["errors"].append("PyTorch 未安装")
        print("⚠️ PyTorch 未安装", flush=True)
    except Exception as e:
        result["errors"].append(str(e))
        print(f"⚠️ 硬件检测异常: {e}", flush=True)
    
    return result

def classify_error(error_msg):
    """根据错误信息分类并返回处理建议"""
    error_lower = error_msg.lower()
    
    for key, mapping in ERROR_MAPPINGS.items():
        for keyword in mapping["keywords"]:
            if keyword.lower() in error_lower:
                return {
                    "type": mapping["type"],
                    "title": mapping["title"],
                    "suggestions": mapping["suggestions"],
                    "raw_error": error_msg[:500]
                }
    
    return {
        "type": "unknown",
        "title": "训练错误",
        "suggestions": ["请检查配置参数是否正确", "查看下方原始错误信息"],
        "raw_error": error_msg[:500]
    }

def export_model(model, args, model_path):
    """训练完成后自动导出模型到多种格式"""
    try:
        export_formats = args.export_formats.split(',') if isinstance(args.export_formats, str) else args.export_formats
        
        print(f"📦 将导出以下格式: {', '.join(export_formats)}")
        
        for pkg in ['pandas', 'matplotlib']:
            try:
                __import__(pkg)
            except ImportError:
                print(f"⚠️ 警告: {pkg} 未安装，导出和绘图功能可能受限", flush=True)
                print(f"   安装命令: pip install {pkg}", flush=True)
        
        results = {
            "event": "export_start",
            "formats": export_formats,
            "base_model": model_path
        }
        
        exported_files = []
        failed_formats = []
        
        for fmt in export_formats:
            fmt = fmt.strip().lower()
            print(f"   正在导出 {fmt} 格式...", flush=True)
            
            try:
                export_path = model.export(format=fmt)
                
                if isinstance(export_path, str):
                    exported_files.append(export_path)
                    print(f"   ✅ {fmt} 导出成功: {export_path}", flush=True)
                else:
                    exported_files.append(str(export_path))
                    print(f"   ✅ {fmt} 导出成功", flush=True)
                    
            except Exception as e:
                failed_formats.append(fmt)
                print(f"   ❌ {fmt} 导出失败: {e}", flush=True)
        
        print(f"\n✅ 模型导出完成!", flush=True)
        
        final_result = {
            "event": "export_complete",
            "exported": exported_files,
            "failed": failed_formats,
            "total": len(export_formats),
            "success_count": len(exported_files),
            "failed_count": len(failed_formats)
        }
        
        log_json(final_result)
        
        if failed_formats:
            print(f"\n⚠️ 以下格式导出失败: {', '.join(failed_formats)}", flush=True)
        
        return final_result
        
    except Exception as e:
        print(f"⚠️ 模型导出过程中发生错误: {e}", file=sys.stderr)
        log_json({
            "event": "export_error",
            "message": str(e),
            "base_model": model_path
        })
        return None

def validate_model(model, args, model_path):
    """训练完成后执行模型验证，生成评估指标、混淆矩阵和 PR 曲线"""
    try:
        val_results = model.val(
            data=args.data,
            batch=args.batch,
            imgsz=args.imgsz,
            device=args.device,
            save_json=True,
            save_hybrid=True,
            plots=True
        )
        
        print("✅ 模型验证完成！")
        
        validation_data = {
            "event": "validation_complete",
            "model_path": model_path,
            "metrics": {}
        }
        
        # 提取主要评估指标
        if hasattr(val_results, 'box'):
            box_metrics = val_results.box
            validation_data["metrics"] = {
                "mAP50": float(getattr(box_metrics, 'map50', 0)),
                "mAP50-95": float(getattr(box_metrics, 'map', 0)),
                "precision": float(getattr(box_metrics, 'mp', 0)),
                "recall": float(getattr(box_metrics, 'mr', 0)),
                "f1": float(getattr(box_metrics, 'mf', 0)) if hasattr(box_metrics, 'mf') else 0.0
            }
        
        if hasattr(val_results, 'pose'):
            pose_metrics = val_results.pose
            validation_data["metrics"]["pose_mAP50"] = float(getattr(pose_metrics, 'map50', 0)) if hasattr(pose_metrics, 'map50') else 0.0
            validation_data["metrics"]["pose_mAP50-95"] = float(getattr(pose_metrics, 'map', 0)) if hasattr(pose_metrics, 'map') else 0.0
        
        # 生成混淆矩阵和 PR 曲线的路径
        results_dir = os.path.join(args.project, args.name)
        
        confusion_matrix_path = os.path.join(results_dir, 'confusion_matrix.png')
        pr_curve_path = os.path.join(results_dir, 'PR_curve.png')
        
        validation_data["artifacts"] = {
            "confusion_matrix": confusion_matrix_path if os.path.exists(confusion_matrix_path) else None,
            "pr_curve": pr_curve_path if os.path.exists(pr_curve_path) else None
        }
        
        # 打印评估指标
        metrics = validation_data["metrics"]
        print(f"📊 验证指标:")
        print(f"   mAP@50: {metrics.get('mAP50', 0):.4f}")
        print(f"   mAP@50-95: {metrics.get('mAP50-95', 0):.4f}")
        print(f"   Precision: {metrics.get('precision', 0):.4f}")
        print(f"   Recall: {metrics.get('recall', 0):.4f}")
        
        if metrics.get('pose_mAP50'):
            print(f"   Pose mAP@50: {metrics.get('pose_mAP50', 0):.4f}")
        
        # 发送验证结果到前端
        log_json(validation_data)
        
        return validation_data
        
    except Exception as e:
        print(f"⚠️ 模型验证过程中发生错误: {e}", file=sys.stderr)
        log_json({
            "event": "validation_error",
            "message": str(e),
            "model_path": model_path
        })
        return None

def format_user_friendly_error(error_msg):
    """将技术错误转换为用户友好的错误信息"""
    classified = classify_error(error_msg)
    
    return {
        "event": "error",
        "type": classified["type"],
        "title": classified["title"],
        "message": error_msg[:300],
        "suggestions": classified["suggestions"],
        "action": "请根据建议调整后重试"
    }

def on_train_epoch_end(trainer):
    log_data = {
        "event": "epoch_end",
        "epoch": trainer.epoch + 1,
        "epochs": trainer.epochs,
        "box_loss": float(trainer.loss_items[0]) if hasattr(trainer, 'loss_items') and len(trainer.loss_items) > 0 else 0.0,
        "cls_loss": float(trainer.loss_items[1]) if hasattr(trainer, 'loss_items') and len(trainer.loss_items) > 1 else 0.0,
        "dfl_loss": float(trainer.loss_items[2]) if hasattr(trainer, 'loss_items') and len(trainer.loss_items) > 2 else 0.0,
    }

    if hasattr(trainer, 'metrics') and trainer.metrics:
        if hasattr(trainer.metrics, 'box'):
            log_data["mAP50"] = float(getattr(trainer.metrics.box, 'map50', 0))
            log_data["mAP50-95"] = float(getattr(trainer.metrics.box, 'map', 0))

    if hasattr(trainer, 'device') and trainer.device:
        log_data["gpu_mem"] = str(trainer.device)
    else:
        log_data["gpu_mem"] = "cpu"

    log_json(log_data)

def on_train_start(trainer):
    log_json({
        "event": "train_start",
        "model": trainer.args.model,
        "epochs": trainer.epochs,
        "batch": trainer.args.batch,
        "imgsz": trainer.args.imgsz
    })

def check_resume_available(args):
    """智能断点续训检测：检查是否存在可恢复的训练"""
    resume_info = {
        "available": False,
        "last_pt_path": None,
        "last_epoch": None,
        "best_epoch": None,
        "metrics": {}
    }
    
    try:
        project_dir = os.path.join(args.project, args.name) if args.project and args.name else None
        if not project_dir or not os.path.exists(project_dir):
            return resume_info
        
        weights_dir = os.path.join(project_dir, 'weights')
        if not os.path.exists(weights_dir):
            return resume_info
        
        last_pt_path = os.path.join(weights_dir, 'last.pt')
        if not os.path.exists(last_pt_path):
            return resume_info
        
        print(f"🔍 检测到上次训练: {last_pt_path}", flush=True)
        
        try:
            checkpoint = torch.load(last_pt_path, map_location='cpu')
            
            resume_info["available"] = True
            resume_info["last_pt_path"] = last_pt_path
            
            if 'epoch' in checkpoint:
                resume_info["last_epoch"] = checkpoint['epoch']
                print(f"   📊 上次训练轮次: {checkpoint['epoch']}", flush=True)
            
            if 'best_epoch' in checkpoint:
                resume_info["best_epoch"] = checkpoint['best_epoch']
            
            if 'metrics' in checkpoint:
                resume_info["metrics"] = checkpoint['metrics']
                if 'best_map50' in checkpoint['metrics']:
                    print(f"   📈 最佳 mAP@50: {checkpoint['metrics']['best_map50']:.4f}", flush=True)
            
            if 'model' in checkpoint:
                model_info = checkpoint.get('model', {})
                if hasattr(model_info, 'args'):
                    saved_args = model_info.args if hasattr(model_info, 'args') else {}
                    resume_info["saved_config"] = {
                        "model": saved_args.get('model', 'unknown'),
                        "data": saved_args.get('data', 'unknown'),
                        "imgsz": saved_args.get('imgsz', 'unknown'),
                        "batch": saved_args.get('batch', 'unknown')
                    }
                    print(f"   ⚙️ 上次配置: model={saved_args.get('model')}, imgsz={saved_args.get('imgsz')}", flush=True)
            
            log_json({
                "event": "resume_detected",
                "resume_info": resume_info
            })
            
        except Exception as e:
            print(f"   ⚠️ 读取检查点失败: {e}", flush=True)
        
        return resume_info
        
    except Exception as e:
        return resume_info

def validate_config(args):
    """飞行前检查：验证配置完整性和数据有效性"""
    print("🔍 开始飞行前检查 (Pre-flight Check)...", flush=True)
    
    issues = []
    warnings = []
    checks_passed = {
        "yaml_file": False,
        "train_path": False,
        "val_path": False,
        "train_images": False,
        "val_images": False,
        "dependencies": False
    }
    
    # 1. YAML 配置文件验证
    print("  📄 检查 YAML 配置文件...", flush=True)
    try:
        import yaml
        
        if not os.path.exists(args.data):
            issues.append(f"YAML 配置文件不存在: {args.data}")
        else:
            checks_passed["yaml_file"] = True
            with open(args.data, 'r', encoding='utf-8') as f:
                yaml_content = yaml.safe_load(f)
            
            if not yaml_content:
                issues.append("YAML 配置文件为空")
            else:
                # 检查必需字段
                required_fields = ['path', 'train']
                for field in required_fields:
                    if field not in yaml_content:
                        issues.append(f"YAML 缺少必需字段: {field}")
                
                if 'path' in yaml_content:
                    base_path = yaml_content['path']
                    
                    # 2. 检查 train 和 val 路径
                    if 'train' in yaml_content:
                        train_path = os.path.join(base_path, yaml_content['train']) if not os.path.isabs(yaml_content['train']) else yaml_content['train']
                        if os.path.exists(train_path):
                            checks_passed["train_path"] = True
                            print(f"     ✅ 训练集路径存在: {train_path}", flush=True)
                        else:
                            issues.append(f"训练集路径不存在: {train_path}")
                    
                    if 'val' in yaml_content:
                        val_path = os.path.join(base_path, yaml_content['val']) if not os.path.isabs(yaml_content['val']) else yaml_content['val']
                        if os.path.exists(val_path):
                            checks_passed["val_path"] = True
                            print(f"     ✅ 验证集路径存在: {val_path}", flush=True)
                        else:
                            warnings.append(f"验证集路径不存在: {val_path}")
                    
                    if 'test' in yaml_content:
                        test_path = os.path.join(base_path, yaml_content['test']) if not os.path.isabs(yaml_content['test']) else yaml_content['test']
                        if os.path.exists(test_path):
                            print(f"     ✅ 测试集路径存在: {test_path}", flush=True)
                        else:
                            warnings.append(f"测试集路径不存在: {test_path}")
                
                print("     ✅ YAML 配置文件格式正确", flush=True)
    except ImportError:
        issues.append("缺少 pyyaml 库，请运行: pip install pyyaml")
    except yaml.YAMLError as e:
        issues.append(f"YAML 语法错误: {e}")
    except Exception as e:
        issues.append(f"YAML 读取错误: {e}")
    
    # 3. 图像数据有效性检查
    print("  🖼️ 检查图像数据有效性...", flush=True)
    
    def check_image_samples(directory, split_name, min_samples=5):
        if not os.path.exists(directory):
            return False, 0
        
        image_extensions = ('.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp')
        images = [f for f in os.listdir(directory) if f.lower().endswith(image_extensions)]
        
        if len(images) < min_samples:
            warnings.append(f"{split_name} 集图片数量较少: {len(images)} (建议至少 {min_samples} 张)")
        
        # 随机抽样验证图片可读性
        import random
        random.seed(42)
        
        sample_images = random.sample(images, min(len(images), min_samples)) if images else []
        
        try:
            from PIL import Image
            for img_file in sample_images:
                img_path = os.path.join(directory, img_file)
                try:
                    img = Image.open(img_path)
                    img.verify()
                except Exception as e:
                    issues.append(f"{split_name} 集图片损坏: {img_file} - {e}")
                    return False, len(images)
        except ImportError:
            warnings.append("PIL 库未安装，跳过图片完整性验证")
        
        return True, len(images)
    
    try:
        import yaml
        if os.path.exists(args.data):
            with open(args.data, 'r', encoding='utf-8') as f:
                yaml_content = yaml.safe_load(f)
            
            if yaml_content and 'path' in yaml_content:
                base_path = yaml_content['path']
                
                if 'train' in yaml_content:
                    train_dir = os.path.join(base_path, yaml_content['train']) if not os.path.isabs(yaml_content['train']) else yaml_content['train']
                    ok, count = check_image_samples(train_dir, "训练")
                    if ok:
                        checks_passed["train_images"] = True
                        print(f"     ✅ 训练集图片检查通过 ({count} 张)", flush=True)
                
                if 'val' in yaml_content:
                    val_dir = os.path.join(base_path, yaml_content['val']) if not os.path.isabs(yaml_content['val']) else yaml_content['val']
                    ok, count = check_image_samples(val_dir, "验证")
                    if ok:
                        checks_passed["val_images"] = True
                        print(f"     ✅ 验证集图片检查通过 ({count} 张)", flush=True)
    except Exception as e:
        warnings.append(f"图片检查出错: {e}")
    
    # 4. 依赖库版本验证
    print("  📦 检查依赖库版本...", flush=True)
    
    def check_package_version(package_name, min_version=None):
        try:
            import importlib
            mod = importlib.import_module(package_name)
            version = getattr(mod, '__version__', 'unknown')
            return True, version
        except ImportError:
            return False, None
    
    required_packages = {
        'ultralytics': '8.0.0',
        'torch': '2.0.0',
        'cv2': '4.8.0',
        'PIL': '10.0.0',
        'numpy': '1.24.0',
        'yaml': '6.0',
        'pandas': '2.0.0',
        'matplotlib': '3.7.0'
    }
    
    all_deps_ok = True
    for pkg, min_ver in required_packages.items():
        ok, version = check_package_version(pkg)
        if ok:
            print(f"     ✅ {pkg}: {version}", flush=True)
        else:
            issues.append(f"缺少必需包: {pkg} (需要版本 >= {min_ver})")
            all_deps_ok = False
    
    if all_deps_ok:
        checks_passed["dependencies"] = True
    
    # 检查 ultralytics 特定版本
    try:
        from ultralytics import __version__ as ultralytics_version
        print(f"     📌 ultralytics 版本: {ultralytics_version}", flush=True)
    except:
        pass
    
    # 汇总结果
    print("\n" + "="*50, flush=True)
    print("📋 飞行前检查结果:", flush=True)
    print("="*50, flush=True)
    
    passed_count = sum(checks_passed.values())
    total_count = len(checks_passed)
    
    for check_name, passed in checks_passed.items():
        status = "✅ 通过" if passed else "❌ 失败"
        print(f"  {status}: {check_name}", flush=True)
    
    if warnings:
        print("\n⚠️ 警告:", flush=True)
        for w in warnings:
            print(f"  - {w}", flush=True)
    
    if issues:
        print("\n❌ 检查未通过:", flush=True)
        for issue in issues:
            print(f"  - {issue}", flush=True)
        print("\n🚫 启动终止：配置验证失败", flush=True)
        
        log_json({
            "event": "validation_failed",
            "passed": passed_count,
            "total": total_count,
            "issues": issues,
            "warnings": warnings
        })
        
        return False
    
    print(f"\n✅ 所有检查通过 ({passed_count}/{total_count})", flush=True)
    print("="*50 + "\n", flush=True)
    
    if warnings:
        log_json({
            "event": "validation_passed_with_warnings",
            "passed": passed_count,
            "total": total_count,
            "warnings": warnings
        })
    else:
        log_json({
            "event": "validation_passed",
            "passed": passed_count,
            "total": total_count
        })
    
    return True

def train_model(args):
    try:
        # 步骤 0: 飞行前检查（可选跳过）
        if not args.skip_validation:
            print("="*60, flush=True)
            print("🚀 启动训练流程", flush=True)
            print("="*60, flush=True)
            
            validation_ok = validate_config(args)
            if not validation_ok:
                sys.exit(1)
        else:
            print("⚠️ 已跳过飞行前检查 (--skip-validation)", flush=True)
        
        # 步骤 0.5: 智能断点续训检测
        if not args.resume:
            resume_info = check_resume_available(args)
            if resume_info["available"]:
                print("\n" + "="*60, flush=True)
                print("🔄 检测到可恢复的训练!", flush=True)
                print("="*60, flush=True)
                if resume_info["last_epoch"]:
                    print(f"   上次训练轮次: {resume_info['last_epoch']}", flush=True)
                if resume_info["metrics"] and "best_map50" in resume_info["metrics"]:
                    print(f"   最佳 mAP@50: {resume_info['metrics']['best_map50']:.4f}", flush=True)
                print("\n如需从上次中断处继续训练，请添加 --resume 参数", flush=True)
                print("="*60 + "\n", flush=True)
        
        # 启动父进程监控线程
        monitor_thread = threading.Thread(target=parent_monitor_thread, daemon=True)
        monitor_thread.start()
        
        # 步骤 1: 硬件环境预检测
        hw_info = detect_hardware()
        log_json({
            "event": "hardware_check",
            "available": hw_info["available"],
            "gpu_count": hw_info["gpu_count"],
            "gpu_name": hw_info["gpu_name"],
            "cuda_version": hw_info["cuda_version"],
            "torch_cuda_version": hw_info["torch_cuda_version"]
        })
        
        # 步骤 2: 如果用户指定了 GPU 但硬件不支持，给出警告
        if args.device != 'cpu' and not hw_info["available"]:
            print("⚠️ 警告: 您指定了 GPU 设备但系统不支持 CUDA", flush=True)
            print("   将自动切换到 CPU 模式继续训练", flush=True)
            args.device = 'cpu'
        
        abs_data_path = os.path.abspath(args.data)
        if not os.path.exists(abs_data_path):
            raise FileNotFoundError(f"找不到配置文件: {abs_data_path}")

        print(f"🚀 开始加载模型: {args.model}")
        print(f"📂 数据集路径: {abs_data_path}")

        model = YOLO(args.model)

        model.add_callback("on_train_start", on_train_start)
        model.add_callback("on_train_epoch_end", on_train_epoch_end)

        if args.resume:
            print("🔄 正在恢复中断的训练...")
            log_json({"event": "resume", "message": "Resuming training"})
            model.train(resume=True)
        else:
            augment_params = {
                'degrees': args.degrees,
                'translate': args.translate,
                'scale': args.scale,
                'shear': args.shear,
                'perspective': args.perspective,
                'fliplr': args.fliplr,
                'flipud': args.flipud,
                'hsv_h': args.hsv_h,
                'hsv_s': args.hsv_s,
                'hsv_v': args.hsv_v,
                'mosaic': args.mosaic,
                'mixup': args.mixup,
                'copy_paste': args.copy_paste,
                'erasing': args.erasing,
                'crop_fraction': args.crop_fraction,
            }

            print(f"📊 数据增强配置:")
            for k, v in augment_params.items():
                print(f"   {k}: {v}")

            training_params = {
                'data': abs_data_path,
                'epochs': args.epochs,
                'batch': args.batch,
                'imgsz': args.imgsz,
                'project': args.project,
                'name': args.name,
                'device': args.device,
                'workers': args.workers,
                'patience': args.patience,
                'optimizer': args.optimizer,
                'cos_lr': args.cos_lr,
                'rect': args.rect,
                **augment_params,
                'exist_ok': True,
                'verbose': True
            }

            if args.cache_images:
                training_params['cache'] = True
            if hasattr(args, 'close_mosaic') and args.close_mosaic > 0:
                training_params['close_mosaic'] = args.close_mosaic
            if hasattr(args, 'loss_pose'):
                training_params['pose'] = args.loss_pose
            if hasattr(args, 'loss_box'):
                training_params['box'] = args.loss_box
            if hasattr(args, 'loss_cls'):
                training_params['cls'] = args.loss_cls

            print(f"📊 训练配置:")
            for k, v in training_params.items():
                if k not in augment_params:
                    print(f"   {k}: {v}")

            results = model.train(**training_params)

        best_model_path = os.path.join(args.project, args.name, 'weights', 'best.pt')
        print(f"✅ 训练完成！最佳模型已保存至: {best_model_path}")
        log_json({
            "event": "train_complete",
            "best_model": best_model_path
        })
        
        # 训练完成后执行模型验证
        print("🔍 正在执行模型验证...")
        validation_result = validate_model(model, args, best_model_path)
        
        # 训练完成后自动导出模型
        if hasattr(args, 'export_formats') and args.export_formats:
            print("📦 正在导出模型...")
            export_results = export_model(model, args, best_model_path)
        
    except Exception as e:
        error_msg = str(e)
        print(f"❌ 训练过程中发生错误: {e}", file=sys.stderr)
        
        # 使用友好的错误格式
        friendly_error = format_user_friendly_error(error_msg)
        log_json(friendly_error)
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Train YOLOv8-Pose for Fish Keypoints')

    parser.add_argument('--data', type=str, default='data.yaml', help='Path to data.yaml')
    parser.add_argument('--model', type=str, default='yolov8s-pose.pt', help='Base model')
    parser.add_argument('--epochs', type=int, default=150, help='Number of epochs')
    parser.add_argument('--batch', type=int, default=2, help='Batch size')
    parser.add_argument('--imgsz', type=int, default=1280, help='Image input size')

    parser.add_argument('--project', type=str, default='fish_run', help='Project directory')
    parser.add_argument('--name', type=str, default='exp_3', help='Experiment name')

    parser.add_argument('--device', type=str, default='0', help='Device (0, 1, 2 or cpu)')
    parser.add_argument('--workers', type=int, default=0, help='Dataloader workers')
    parser.add_argument('--cache_images', action='store_true', help='Cache images to memory')
    parser.add_argument('--patience', type=int, default=60, help='Early stopping patience')
    parser.add_argument('--cos_lr', action='store_true', help='Use cosine LR scheduler')
    parser.add_argument('--optimizer', type=str, default='auto', help='Optimizer (auto, SGD, Adam, AdamW)')
    parser.add_argument('--rect', action='store_true', help='Use rectangular training')

    parser.add_argument('--resume', action='store_true', help='Resume most recent training')

    parser.add_argument('--degrees', type=float, default=180.0, help='Rotation range')
    parser.add_argument('--translate', type=float, default=0.2, help='Translation fraction')
    parser.add_argument('--scale', type=float, default=0.6, help='Scale factor')
    parser.add_argument('--shear', type=float, default=0.0, help='Shear range')
    parser.add_argument('--perspective', type=float, default=0.001, help='Perspective distortion')

    parser.add_argument('--fliplr', type=float, default=0.5, help='Horizontal flip probability')
    parser.add_argument('--flipud', type=float, default=0.5, help='Vertical flip probability')

    parser.add_argument('--hsv_h', type=float, default=0.015, help='HSV Hue augmentation')
    parser.add_argument('--hsv_s', type=float, default=0.7, help='HSV Saturation augmentation')
    parser.add_argument('--hsv_v', type=float, default=0.4, help='HSV Value augmentation')

    parser.add_argument('--mosaic', type=float, default=0.0, help='Mosaic augmentation probability')
    parser.add_argument('--close_mosaic', type=int, default=0, help='Close mosaic in last N epochs')
    parser.add_argument('--mixup', type=float, default=0.0, help='MixUp augmentation probability')
    parser.add_argument('--copy_paste', type=float, default=0.0, help='Copy-paste augmentation probability')

    parser.add_argument('--erasing', type=float, default=0.4, help='Random erasing probability')
    parser.add_argument('--crop_fraction', type=float, default=1.0, help='Crop fraction')
    
    parser.add_argument('--skip_validation', action='store_true', help='Skip pre-flight validation check')
    
    parser.add_argument('--export_formats', type=str, default='', help='Auto-export formats after training (e.g., "onnx,tflite,torchscript")')

    parser.add_argument('--loss_pose', type=float, default=25.0, help='Pose loss weight')
    parser.add_argument('--loss_box', type=float, default=7.5, help='Box loss weight')
    parser.add_argument('--loss_cls', type=float, default=0.5, help='Class loss weight')

    args = parser.parse_args()

    train_model(args)
