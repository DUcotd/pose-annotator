import argparse
import sys
import os
import json
import time
import signal
import threading
import psutil
import random
import numpy as np
from pathlib import Path

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

from ultralytics import YOLO

GPU_MONITOR_INTERVAL = 2.0
GPU_MEMORY_WARNING_THRESHOLD = 0.85
GPU_UTIL_WARNING_THRESHOLD = 0.30

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
            try:
                map50_val = getattr(box_metrics, 'map50', 0)
                map_val = getattr(box_metrics, 'map', 0)
                mp_val = getattr(box_metrics, 'mp', 0)
                mr_val = getattr(box_metrics, 'mr', 0)
                mf_val = getattr(box_metrics, 'mf', 0) if hasattr(box_metrics, 'mf') else 0
                
                validation_data["metrics"] = {
                    "mAP50": float(map50_val.item()) if hasattr(map50_val, 'item') else float(map50_val),
                    "mAP50-95": float(map_val.item()) if hasattr(map_val, 'item') else float(map_val),
                    "precision": float(mp_val.item()) if hasattr(mp_val, 'item') else float(mp_val),
                    "recall": float(mr_val.item()) if hasattr(mr_val, 'item') else float(mr_val),
                    "f1": float(mf_val.item()) if hasattr(mf_val, 'item') else float(mf_val)
                }
            except Exception as e:
                print(f"⚠️ 解析 box metrics 时出错: {e}", flush=True)
                validation_data["metrics"] = {
                    "mAP50": 0.0,
                    "mAP50-95": 0.0,
                    "precision": 0.0,
                    "recall": 0.0,
                    "f1": 0.0
                }
        
        if hasattr(val_results, 'pose'):
            pose_metrics = val_results.pose
            try:
                map50_val = getattr(pose_metrics, 'map50', 0) if hasattr(pose_metrics, 'map50') else 0
                map_val = getattr(pose_metrics, 'map', 0) if hasattr(pose_metrics, 'map') else 0
                validation_data["metrics"]["pose_mAP50"] = float(map50_val.item()) if hasattr(map50_val, 'item') else float(map50_val)
                validation_data["metrics"]["pose_mAP50-95"] = float(map_val.item()) if hasattr(map_val, 'item') else float(map_val)
            except Exception as e:
                print(f"⚠️ 解析 pose metrics 时出错: {e}", flush=True)
                validation_data["metrics"]["pose_mAP50"] = 0.0
                validation_data["metrics"]["pose_mAP50-95"] = 0.0
        
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

class GPUMonitor:
    def __init__(self, device_id=0):
        self.device_id = device_id
        self.running = False
        self.monitor_thread = None
        self.latest_stats = {
            "gpu_memory_used_gb": 0.0,
            "gpu_memory_total_gb": 0.0,
            "gpu_memory_percent": 0.0,
            "gpu_utilization_percent": 0.0,
            "gpu_temperature": 0,
            "gpu_power_draw": 0.0,
            "gpu_power_limit": 0.0,
            "warnings": []
        }
        self.history = []
        self.max_history = 100
        self.pynvml_available = False
        self._init_pynvml()
    
    def _init_pynvml(self):
        try:
            import pynvml
            pynvml.nvmlInit()
            self.pynvml = pynvml
            self.handle = pynvml.nvmlDeviceGetHandleByIndex(self.device_id)
            self.pynvml_available = True
            print(f"✅ GPU监控已初始化 (设备 {self.device_id})", flush=True)
        except ImportError:
            print("⚠️ pynvml未安装，GPU监控功能受限。安装: pip install pynvml", flush=True)
        except Exception as e:
            print(f"⚠️ GPU监控初始化失败: {e}", flush=True)
    
    def get_gpu_stats(self):
        stats = {
            "gpu_memory_used_gb": 0.0,
            "gpu_memory_total_gb": 0.0,
            "gpu_memory_percent": 0.0,
            "gpu_utilization_percent": 0.0,
            "gpu_temperature": 0,
            "gpu_power_draw": 0.0,
            "gpu_power_limit": 0.0,
            "warnings": []
        }
        
        if self.pynvml_available:
            try:
                mem_info = self.pynvml.nvmlDeviceGetMemoryInfo(self.handle)
                stats["gpu_memory_used_gb"] = round(mem_info.used / (1024**3), 2)
                stats["gpu_memory_total_gb"] = round(mem_info.total / (1024**3), 2)
                stats["gpu_memory_percent"] = round(mem_info.used / mem_info.total * 100, 1)
                
                util_info = self.pynvml.nvmlDeviceGetUtilizationRates(self.handle)
                stats["gpu_utilization_percent"] = util_info.gpu
                
                try:
                    stats["gpu_temperature"] = self.pynvml.nvmlDeviceGetTemperature(self.handle, self.pynvml.NVML_TEMPERATURE_GPU)
                except:
                    pass
                
                try:
                    power_info = self.pynvml.nvmlDeviceGetPowerUsage(self.handle)
                    stats["gpu_power_draw"] = round(power_info / 1000.0, 1)
                    power_limit = self.pynvml.nvmlDeviceGetPowerManagementLimit(self.handle)
                    stats["gpu_power_limit"] = round(power_limit / 1000.0, 1)
                except:
                    pass
                
                if stats["gpu_memory_percent"] > GPU_MEMORY_WARNING_THRESHOLD * 100:
                    stats["warnings"].append(f"显存使用率过高: {stats['gpu_memory_percent']:.1f}%")
                
                if stats["gpu_utilization_percent"] < GPU_UTIL_WARNING_THRESHOLD * 100:
                    stats["warnings"].append(f"GPU利用率低: {stats['gpu_utilization_percent']:.1f}% (可能存在IO瓶颈)")
                
            except Exception as e:
                stats["warnings"].append(f"GPU监控错误: {str(e)[:50]}")
        
        try:
            import torch
            if torch.cuda.is_available():
                stats["torch_memory_allocated_gb"] = round(torch.cuda.memory_allocated(self.device_id) / (1024**3), 3)
                stats["torch_memory_reserved_gb"] = round(torch.cuda.memory_reserved(self.device_id) / (1024**3), 3)
        except:
            pass
        
        return stats
    
    def start_monitoring(self):
        if not self.pynvml_available:
            return
        
        self.running = True
        self.monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.monitor_thread.start()
        print("🔄 GPU监控线程已启动", flush=True)
    
    def _monitor_loop(self):
        while self.running:
            stats = self.get_gpu_stats()
            self.latest_stats = stats
            self.history.append({
                "time": time.time(),
                **stats
            })
            if len(self.history) > self.max_history:
                self.history = self.history[-self.max_history:]
            
            if stats["warnings"]:
                log_json({
                    "event": "gpu_warning",
                    "warnings": stats["warnings"],
                    "stats": {k: v for k, v in stats.items() if k != "warnings"}
                })
            
            time.sleep(GPU_MONITOR_INTERVAL)
    
    def stop_monitoring(self):
        self.running = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=2)
        print("🔄 GPU监控线程已停止", flush=True)
    
    def get_summary(self):
        if not self.history:
            return self.latest_stats
        
        mem_values = [h["gpu_memory_percent"] for h in self.history if h.get("gpu_memory_percent")]
        util_values = [h["gpu_utilization_percent"] for h in self.history if h.get("gpu_utilization_percent")]
        
        return {
            **self.latest_stats,
            "avg_memory_percent": round(np.mean(mem_values), 1) if mem_values else 0,
            "max_memory_percent": round(max(mem_values), 1) if mem_values else 0,
            "avg_utilization_percent": round(np.mean(util_values), 1) if util_values else 0,
            "monitoring_duration_samples": len(self.history)
        }

class PerformanceBenchmark:
    def __init__(self, model, device='0', imgsz=640):
        self.model = model
        self.device = device
        self.imgsz = imgsz
        self.results = {}
    
    def measure_inference_latency(self, num_runs=50, warmup=5):
        import torch
        import numpy as np
        
        print(f"⏱️ 开始推理延迟测试 (预热: {warmup}, 测试: {num_runs})", flush=True)
        
        dummy_input = torch.zeros((1, 3, self.imgsz, self.imgsz))
        if torch.cuda.is_available() and self.device != 'cpu':
            dummy_input = dummy_input.cuda()
        
        for _ in range(warmup):
            try:
                _ = self.model.predict(dummy_input, verbose=False)
            except:
                pass
        
        if torch.cuda.is_available() and self.device != 'cpu':
            torch.cuda.synchronize()
        
        latencies = []
        preprocess_times = []
        inference_times = []
        postprocess_times = []
        
        for i in range(num_runs):
            start_total = time.perf_counter()
            
            preprocess_start = time.perf_counter()
            preprocess_end = time.perf_counter()
            
            if torch.cuda.is_available() and self.device != 'cpu':
                torch.cuda.synchronize()
            
            inference_start = time.perf_counter()
            try:
                _ = self.model.predict(dummy_input, verbose=False)
            except:
                pass
            
            if torch.cuda.is_available() and self.device != 'cpu':
                torch.cuda.synchronize()
            
            inference_end = time.perf_counter()
            
            postprocess_start = time.perf_counter()
            postprocess_end = time.perf_counter()
            
            total_time = (postprocess_end - start_total) * 1000
            latencies.append(total_time)
            
            preprocess_times.append((preprocess_end - preprocess_start) * 1000)
            inference_times.append((inference_end - inference_start) * 1000)
            postprocess_times.append((postprocess_end - postprocess_start) * 1000)
        
        self.results["latency"] = {
            "mean_ms": round(np.mean(latencies), 2),
            "std_ms": round(np.std(latencies), 2),
            "min_ms": round(np.min(latencies), 2),
            "max_ms": round(np.max(latencies), 2),
            "p50_ms": round(np.percentile(latencies, 50), 2),
            "p95_ms": round(np.percentile(latencies, 95), 2),
            "p99_ms": round(np.percentile(latencies, 99), 2),
            "preprocess_mean_ms": round(np.mean(preprocess_times), 2),
            "inference_mean_ms": round(np.mean(inference_times), 2),
            "postprocess_mean_ms": round(np.mean(postprocess_times), 2)
        }
        
        print(f"   平均延迟: {self.results['latency']['mean_ms']:.2f}ms (P95: {self.results['latency']['p95_ms']:.2f}ms)", flush=True)
        
        return self.results["latency"]
    
    def measure_throughput(self, batch_sizes=[1, 2, 4, 8], num_runs=30):
        import torch
        import numpy as np
        
        print(f"🚀 开始吞吐量测试 (Batch Sizes: {batch_sizes})", flush=True)
        
        throughput_results = {}
        
        for batch_size in batch_sizes:
            try:
                dummy_input = torch.zeros((batch_size, 3, self.imgsz, self.imgsz))
                if torch.cuda.is_available() and self.device != 'cpu':
                    dummy_input = dummy_input.cuda()
                
                for _ in range(5):
                    try:
                        _ = self.model.predict(dummy_input, verbose=False)
                    except:
                        pass
                
                if torch.cuda.is_available() and self.device != 'cpu':
                    torch.cuda.synchronize()
                
                times = []
                for _ in range(num_runs):
                    start = time.perf_counter()
                    try:
                        _ = self.model.predict(dummy_input, verbose=False)
                    except:
                        continue
                    
                    if torch.cuda.is_available() and self.device != 'cpu':
                        torch.cuda.synchronize()
                    
                    end = time.perf_counter()
                    times.append(end - start)
                
                if times:
                    avg_time = np.mean(times)
                    fps = batch_size / avg_time
                    throughput_results[batch_size] = {
                        "batch_size": batch_size,
                        "avg_time_s": round(avg_time, 4),
                        "fps": round(fps, 1),
                        "fps_per_image": round(1 / avg_time, 1)
                    }
                    print(f"   Batch {batch_size}: {fps:.1f} FPS ({1/avg_time:.1f} FPS/image)", flush=True)
                
                del dummy_input
                if torch.cuda.is_available() and self.device != 'cpu':
                    torch.cuda.empty_cache()
                    
            except Exception as e:
                print(f"   Batch {batch_size}: 测试失败 - {str(e)[:50]}", flush=True)
                throughput_results[batch_size] = {"error": str(e)[:100]}
        
        self.results["throughput"] = throughput_results
        return throughput_results
    
    def get_realtime_fps(self):
        if "latency" not in self.results:
            return 0
        mean_latency_ms = self.results["latency"]["mean_ms"]
        if mean_latency_ms > 0:
            return round(1000 / mean_latency_ms, 1)
        return 0
    
    def get_summary(self):
        return {
            "latency": self.results.get("latency", {}),
            "throughput": self.results.get("throughput", {}),
            "realtime_fps": self.get_realtime_fps(),
            "meets_realtime_requirement": self.get_realtime_fps() >= 25
        }

class VisualValidator:
    def __init__(self, model, data_yaml, output_dir, num_samples=3):
        self.model = model
        self.data_yaml = data_yaml
        self.output_dir = Path(output_dir)
        self.num_samples = num_samples
        self.val_images = []
        self._load_val_images()
    
    def _load_val_images(self):
        try:
            import yaml
            with open(self.data_yaml, 'r', encoding='utf-8') as f:
                data_config = yaml.safe_load(f)
            
            base_path = data_config.get('path', '')
            val_path = data_config.get('val', '')
            
            if not os.path.isabs(val_path):
                val_path = os.path.join(base_path, val_path)
            
            if os.path.exists(val_path):
                image_extensions = ('.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp')
                self.val_images = [
                    os.path.join(val_path, f) 
                    for f in os.listdir(val_path) 
                    if f.lower().endswith(image_extensions)
                ]
                print(f"✅ 加载了 {len(self.val_images)} 张验证图片用于可视化", flush=True)
        except Exception as e:
            print(f"⚠️ 加载验证图片失败: {e}", flush=True)
    
    def select_representative_samples(self, predictions):
        if len(self.val_images) <= self.num_samples:
            return self.val_images
        
        samples = {
            "high_confidence": None,
            "medium_confidence": None,
            "low_confidence": None
        }
        
        confidences = []
        for img_path in self.val_images[:min(50, len(self.val_images))]:
            try:
                results = self.model.predict(img_path, verbose=False)
                if results and len(results) > 0:
                    boxes = results[0].boxes
                    if boxes is not None and len(boxes) > 0:
                        conf = boxes.conf.max().item()
                        confidences.append((img_path, conf))
            except:
                pass
        
        if confidences:
            confidences.sort(key=lambda x: x[1], reverse=True)
            
            high_idx = 0
            low_idx = len(confidences) - 1
            mid_idx = len(confidences) // 2
            
            samples["high_confidence"] = confidences[high_idx][0] if high_idx < len(confidences) else None
            samples["medium_confidence"] = confidences[mid_idx][0] if mid_idx < len(confidences) else None
            samples["low_confidence"] = confidences[low_idx][0] if low_idx < len(confidences) else None
        
        return samples
    
    def generate_visualization(self, epoch, samples=None):
        if not self.val_images:
            return None
        
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        if samples is None:
            samples = self.select_representative_samples([])
        
        visualization_results = {
            "epoch": epoch,
            "samples": [],
            "output_dir": str(self.output_dir)
        }
        
        sample_list = []
        if isinstance(samples, dict):
            for category, path in samples.items():
                if path:
                    sample_list.append((category, path))
        else:
            for path in samples[:self.num_samples]:
                sample_list.append(("sample", path))
        
        for category, img_path in sample_list:
            try:
                results = self.model.predict(img_path, verbose=False)
                
                if results and len(results) > 0:
                    result = results[0]
                    
                    save_path = self.output_dir / f"epoch_{epoch}_{category}.jpg"
                    
                    try:
                        plotted = result.plot()
                        import cv2
                        cv2.imwrite(str(save_path), plotted)
                    except Exception as e:
                        print(f"⚠️ 保存可视化失败: {e}", flush=True)
                    
                    sample_info = {
                        "category": category,
                        "image_path": img_path,
                        "output_path": str(save_path),
                        "num_detections": len(result.boxes) if result.boxes is not None else 0
                    }
                    
                    if result.boxes is not None and len(result.boxes) > 0:
                        confs = result.boxes.conf.cpu().numpy()
                        sample_info["avg_confidence"] = float(np.mean(confs))
                        sample_info["max_confidence"] = float(np.max(confs))
                        sample_info["min_confidence"] = float(np.min(confs))
                    
                    if hasattr(result, 'keypoints') and result.keypoints is not None:
                        kpts = result.keypoints
                        if hasattr(kpts, 'data') and kpts.data is not None:
                            sample_info["num_keypoints_detected"] = len(kpts.data)
                    
                    visualization_results["samples"].append(sample_info)
                    
            except Exception as e:
                print(f"⚠️ 处理图片 {img_path} 失败: {e}", flush=True)
        
        return visualization_results

def get_per_keypoint_metrics(model, data_yaml, device='0'):
    try:
        import torch
        from ultralytics.utils.metrics import PoseMetricsStats
        
        print("📊 开始计算各关键点误差分析...", flush=True)
        
        val_results = model.val(
            data=data_yaml,
            device=device,
            verbose=False
        )
        
        keypoint_metrics = {
            "event": "per_keypoint_metrics",
            "keypoints": []
        }
        
        if hasattr(val_results, 'pose') and val_results.pose is not None:
            pose_metrics = val_results.pose
            
            if hasattr(pose_metrics, 'ap_per_class'):
                ap_per_class = pose_metrics.ap_per_class
                for i, ap in enumerate(ap_per_class):
                    try:
                        ap_value = float(ap.item()) if hasattr(ap, 'item') else float(ap) if ap is not None else 0.0
                    except:
                        ap_value = 0.0
                    keypoint_metrics["keypoints"].append({
                        "keypoint_id": i,
                        "ap": ap_value
                    })
        
        if hasattr(val_results, 'keypoints') and val_results.keypoints is not None:
            kpts = val_results.keypoints
            if hasattr(kpts, 'data'):
                for i, kpt_data in enumerate(kpts.data):
                    if len(keypoint_metrics["keypoints"]) > i:
                        try:
                            if hasattr(kpt_data, 'mean'):
                                mean_val = kpt_data.mean()
                                vis_value = float(mean_val.item()) if hasattr(mean_val, 'item') else float(mean_val)
                            else:
                                vis_value = 0.0
                        except:
                            vis_value = 0.0
                        keypoint_metrics["keypoints"][i]["visibility"] = vis_value
        
        try:
            results_dir = os.path.dirname(data_yaml)
            keypoint_error_file = os.path.join(results_dir, 'keypoint_errors.json')
            with open(keypoint_error_file, 'w') as f:
                json.dump(keypoint_metrics, f, indent=2)
        except:
            pass
        
        print(f"   分析了 {len(keypoint_metrics['keypoints'])} 个关键点", flush=True)
        
        return keypoint_metrics
        
    except Exception as e:
        print(f"⚠️ 关键点误差分析失败: {e}", flush=True)
        return {"event": "per_keypoint_metrics", "error": str(e), "keypoints": []}

gpu_monitor = None
visual_validator = None
performance_benchmark = None

def on_train_epoch_end(trainer):
    log_data = {
        "event": "epoch_end",
        "epoch": trainer.epoch + 1,
        "epochs": trainer.epochs,
        "totalEpochs": trainer.epochs,
    }

    if hasattr(trainer, 'loss_items') and trainer.loss_items is not None:
        loss_items = trainer.loss_items
        try:
            if hasattr(loss_items, '__len__') and len(loss_items) > 0:
                loss0 = loss_items[0]
                if hasattr(loss0, 'item'):
                    log_data["box_loss"] = float(loss0.item())
                else:
                    log_data["box_loss"] = float(loss0)
            if hasattr(loss_items, '__len__') and len(loss_items) > 1:
                loss1 = loss_items[1]
                if hasattr(loss1, 'item'):
                    log_data["cls_loss"] = float(loss1.item())
                else:
                    log_data["cls_loss"] = float(loss1)
            if hasattr(loss_items, '__len__') and len(loss_items) > 2:
                loss2 = loss_items[2]
                if hasattr(loss2, 'item'):
                    log_data["dfl_loss"] = float(loss2.item())
                else:
                    log_data["dfl_loss"] = float(loss2)
            if hasattr(loss_items, '__len__') and len(loss_items) > 3:
                loss3 = loss_items[3]
                if hasattr(loss3, 'item'):
                    log_data["pose_loss"] = float(loss3.item())
                else:
                    log_data["pose_loss"] = float(loss3)
            if hasattr(loss_items, '__len__') and len(loss_items) > 4:
                loss4 = loss_items[4]
                if hasattr(loss4, 'item'):
                    log_data["kobj_loss"] = float(loss4.item())
                else:
                    log_data["kobj_loss"] = float(loss4)
        except Exception as e:
            print(f"⚠️ 解析 loss_items 时出错: {e}", flush=True)

    if hasattr(trainer, 'metrics') and trainer.metrics:
        if hasattr(trainer.metrics, 'box'):
            box = trainer.metrics.box
            try:
                mp_val = getattr(box, 'mp', 0)
                mr_val = getattr(box, 'mr', 0)
                map50_val = getattr(box, 'map50', 0)
                map_val = getattr(box, 'map', 0)
                log_data["box_precision"] = float(mp_val.item()) if hasattr(mp_val, 'item') else float(mp_val)
                log_data["box_recall"] = float(mr_val.item()) if hasattr(mr_val, 'item') else float(mr_val)
                log_data["mAP50"] = float(map50_val.item()) if hasattr(map50_val, 'item') else float(map50_val)
                log_data["mAP50_95"] = float(map_val.item()) if hasattr(map_val, 'item') else float(map_val)
            except Exception as e:
                print(f"⚠️ 解析 box metrics 时出错: {e}", flush=True)
        
        if hasattr(trainer.metrics, 'pose'):
            pose = trainer.metrics.pose
            try:
                mp_val = getattr(pose, 'mp', 0)
                mr_val = getattr(pose, 'mr', 0)
                map50_val = getattr(pose, 'map50', 0)
                map_val = getattr(pose, 'map', 0)
                log_data["pose_precision"] = float(mp_val.item()) if hasattr(mp_val, 'item') else float(mp_val)
                log_data["pose_recall"] = float(mr_val.item()) if hasattr(mr_val, 'item') else float(mr_val)
                log_data["pose_mAP50"] = float(map50_val.item()) if hasattr(map50_val, 'item') else float(map50_val)
                log_data["pose_mAP50_95"] = float(map_val.item()) if hasattr(map_val, 'item') else float(map_val)
            except Exception as e:
                print(f"⚠️ 解析 pose metrics 时出错: {e}", flush=True)

    if hasattr(trainer, 'device') and trainer.device:
        log_data["gpu_mem"] = str(trainer.device)
    else:
        log_data["gpu_mem"] = "cpu"

    if hasattr(trainer, 'tloss') and trainer.tloss is not None:
        tloss = trainer.tloss
        try:
            if hasattr(tloss, 'item'):
                log_data["train_loss"] = float(tloss.item())
            elif hasattr(tloss, '__len__'):
                log_data["train_loss"] = float(tloss.mean().item() if hasattr(tloss.mean(), 'item') else float(tloss.mean()))
            else:
                log_data["train_loss"] = float(tloss)
        except Exception as e:
            print(f"⚠️ 解析 tloss 时出错: {e}", flush=True)
    
    if hasattr(trainer, 'optimizer') and trainer.optimizer:
        current_lr = None
        if hasattr(trainer.optimizer, 'param_groups') and len(trainer.optimizer.param_groups) > 0:
            current_lr = trainer.optimizer.param_groups[0].get('lr', 0)
        
        if current_lr is not None:
            log_data["learning_rate"] = float(current_lr)
        
        if hasattr(trainer, 'args'):
            args = trainer.args
            log_data["lr0"] = float(getattr(args, 'lr0', 0))
            log_data["lrf"] = float(getattr(args, 'lrf', 0))
            log_data["cos_lr"] = getattr(args, 'cos_lr', False)
    
    global gpu_monitor
    if gpu_monitor is not None:
        gpu_stats = gpu_monitor.get_gpu_stats()
        log_data["gpu_memory_used_gb"] = gpu_stats.get("gpu_memory_used_gb", 0)
        log_data["gpu_memory_total_gb"] = gpu_stats.get("gpu_memory_total_gb", 0)
        log_data["gpu_memory_percent"] = gpu_stats.get("gpu_memory_percent", 0)
        log_data["gpu_utilization_percent"] = gpu_stats.get("gpu_utilization_percent", 0)
        log_data["gpu_temperature"] = gpu_stats.get("gpu_temperature", 0)
        log_data["gpu_power_draw"] = gpu_stats.get("gpu_power_draw", 0)
        
        if gpu_stats.get("torch_memory_allocated_gb"):
            log_data["torch_memory_allocated_gb"] = gpu_stats["torch_memory_allocated_gb"]
        if gpu_stats.get("torch_memory_reserved_gb"):
            log_data["torch_memory_reserved_gb"] = gpu_stats["torch_memory_reserved_gb"]
        
        if gpu_stats.get("warnings"):
            log_data["gpu_warnings"] = gpu_stats["warnings"]

    log_json(log_data)
    
    global visual_validator
    if visual_validator is not None and (trainer.epoch + 1) % 5 == 0:
        try:
            viz_results = visual_validator.generate_visualization(trainer.epoch + 1)
            if viz_results:
                log_json({
                    "event": "visual_validation",
                    **viz_results
                })
        except Exception as e:
            print(f"⚠️ 可视化验证失败: {e}", flush=True)

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
    global gpu_monitor, visual_validator, performance_benchmark
    
    try:
        if not args.skip_validation:
            print("="*60, flush=True)
            print("🚀 启动训练流程", flush=True)
            print("="*60, flush=True)
            
            validation_ok = validate_config(args)
            if not validation_ok:
                sys.exit(1)
        else:
            print("⚠️ 已跳过飞行前检查 (--skip-validation)", flush=True)
        
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
        
        monitor_thread = threading.Thread(target=parent_monitor_thread, daemon=True)
        monitor_thread.start()
        
        hw_info = detect_hardware()
        log_json({
            "event": "hardware_check",
            "available": hw_info["available"],
            "gpu_count": hw_info["gpu_count"],
            "gpu_name": hw_info["gpu_name"],
            "cuda_version": hw_info["cuda_version"],
            "torch_cuda_version": hw_info["torch_cuda_version"],
            "total_memory_gb": hw_info.get("total_memory_gb", 0)
        })
        
        if args.device != 'cpu' and not hw_info["available"]:
            print("⚠️ 警告: 您指定了 GPU 设备但系统不支持 CUDA", flush=True)
            print("   将自动切换到 CPU 模式继续训练", flush=True)
            args.device = 'cpu'
        
        abs_data_path = os.path.abspath(args.data)
        if not os.path.exists(abs_data_path):
            raise FileNotFoundError(f"找不到配置文件: {abs_data_path}")

        models_dir = args.models_dir if args.models_dir else os.path.join(args.project, 'models')
        os.makedirs(models_dir, exist_ok=True)
        
        model_name = args.model
        model_path = model_name
        
        if not os.path.isabs(model_name):
            potential_path = os.path.join(models_dir, model_name)
            if os.path.exists(potential_path):
                model_path = potential_path
                print(f"✅ 使用本地模型: {model_path}", flush=True)
            else:
                os.environ['YOLO_CONFIG_DIR'] = models_dir
                print(f"📥 模型将下载/存储到: {models_dir}", flush=True)
        
        print(f"🚀 开始加载模型: {model_path}")
        print(f"📂 数据集路径: {abs_data_path}")

        model = YOLO(model_path)
        
        device_id = 0
        if args.device != 'cpu':
            try:
                device_id = int(args.device)
            except:
                device_id = 0
        
        if hw_info["available"] and args.device != 'cpu':
            print("🔄 初始化GPU监控...", flush=True)
            gpu_monitor = GPUMonitor(device_id=device_id)
            gpu_monitor.start_monitoring()
            
            initial_stats = gpu_monitor.get_gpu_stats()
            log_json({
                "event": "gpu_monitor_started",
                "device_id": device_id,
                "gpu_name": hw_info.get("gpu_name"),
                "total_memory_gb": initial_stats.get("gpu_memory_total_gb", 0)
            })
        
        output_dir = os.path.join(args.project, args.name, "visualizations")
        visual_validator = VisualValidator(
            model=model,
            data_yaml=abs_data_path,
            output_dir=output_dir,
            num_samples=3
        )

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
        
        if gpu_monitor is not None:
            gpu_monitor.stop_monitoring()
            gpu_summary = gpu_monitor.get_summary()
            log_json({
                "event": "gpu_summary",
                **gpu_summary
            })
        
        print("⏱️ 开始性能基准测试...", flush=True)
        performance_benchmark = PerformanceBenchmark(
            model=model,
            device=args.device,
            imgsz=args.imgsz
        )
        
        latency_results = performance_benchmark.measure_inference_latency(num_runs=30, warmup=3)
        throughput_results = performance_benchmark.measure_throughput(batch_sizes=[1, 2, 4], num_runs=20)
        
        perf_summary = performance_benchmark.get_summary()
        log_json({
            "event": "performance_benchmark",
            **perf_summary
        })
        
        print(f"   实时FPS: {perf_summary['realtime_fps']} {'✅ 满足实时要求' if perf_summary['meets_realtime_requirement'] else '⚠️ 未达实时要求'}")
        
        log_json({
            "event": "train_complete",
            "best_model": best_model_path
        })
        
        print("🔍 正在执行模型验证...")
        validation_result = validate_model(model, args, best_model_path)
        
        print("📊 正在计算关键点细分误差...")
        keypoint_metrics = get_per_keypoint_metrics(model, abs_data_path, args.device)
        log_json(keypoint_metrics)
        
        if hasattr(args, 'export_formats') and args.export_formats:
            print("📦 正在导出模型...")
            export_results = export_model(model, args, best_model_path)
        
    except Exception as e:
        error_msg = str(e)
        print(f"❌ 训练过程中发生错误: {e}", file=sys.stderr)
        
        if gpu_monitor is not None:
            gpu_monitor.stop_monitoring()
        
        friendly_error = format_user_friendly_error(error_msg)
        log_json(friendly_error)
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Train YOLOv8-Pose for Fish Keypoints')

    parser.add_argument('--data', type=str, default='data.yaml', help='Path to data.yaml')
    parser.add_argument('--model', type=str, default='yolov8n-pose.pt', help='Base model')
    parser.add_argument('--epochs', type=int, default=150, help='Number of epochs')
    parser.add_argument('--batch', type=int, default=2, help='Batch size')
    parser.add_argument('--imgsz', type=int, default=1280, help='Image input size')

    parser.add_argument('--project', type=str, default='fish_run', help='Project directory')
    parser.add_argument('--name', type=str, default='exp_3', help='Experiment name')
    parser.add_argument('--models_dir', type=str, default='', help='Directory to store model weights')

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
