import argparse
import sys
import os

# 【优化1】解决 Windows 下 OpenMP 冲突报错 (OMP: Error #15)
# 必须放在导入 ultralytics/torch 之前
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

from ultralytics import YOLO

def train_model(args):
    try:
        # 【优化2】路径检查
        # 将相对路径转换为绝对路径，避免 "Dataset not found" 错误
        abs_data_path = os.path.abspath(args.data)
        if not os.path.exists(abs_data_path):
            raise FileNotFoundError(f"找不到配置文件: {abs_data_path}")

        print(f"🚀 开始加载模型: {args.model}")
        print(f"📂 数据集路径: {abs_data_path}")

        # 加载模型
        model = YOLO(args.model)

        # 【优化3】断点续训逻辑
        # 如果指定了 --resume，则忽略其他参数，直接恢复训练
        if args.resume:
            print("🔄 正在恢复中断的训练...")
            model.train(resume=True)
        else:
            # 构建增强参数
            augment_params = {
                # 几何变换
                'degrees': args.degrees,
                'translate': args.translate,
                'scale': args.scale,
                'shear': args.shear,
                'perspective': args.perspective,
                
                # 翻转
                'fliplr': args.fliplr,
                'flipud': args.flipud,
                
                # 颜色变换
                'hsv_h': args.hsv_h,
                'hsv_s': args.hsv_s,
                'hsv_v': args.hsv_v,
                
                # 亮度对比度
                'brightness': args.brightness,
                'contrast': args.contrast,
                
                # 混合增强
                'mosaic': args.mosaic,
                'mixup': args.mixup,
                'copy_paste': args.copy_paste,
                
                # 模糊和噪声
                'blur': args.blur,
                'noise': args.noise,
                
                # 其他
                'erasing': args.erasing,
                'crop_fraction': args.crop_fraction,
            }

            # 打印增强配置
            print(f"📊 数据增强配置:")
            for k, v in augment_params.items():
                print(f"   {k}: {v}")

            # 开始新训练
            results = model.train(
                data=abs_data_path,
                epochs=args.epochs,
                batch=args.batch,
                imgsz=args.imgsz,
                project=args.project,
                name=args.name,
                device=args.device,
                workers=args.workers,
                
                **augment_params,
                
                # 其他实用参数
                exist_ok=True,
                verbose=True
            )
        
        print(f"✅ 训练完成！最佳模型已保存至: {os.path.join(args.project, args.name, 'weights', 'best.pt')}")
        
    except Exception as e:
        print(f"❌ 训练过程中发生错误: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Train YOLOv8-Pose for Fish Keypoints')
    
    # ========== 基础参数 ==========
    parser.add_argument('--data', type=str, default='data.yaml', help='Path to data.yaml')
    parser.add_argument('--model', type=str, default='yolov8s-pose.pt', help='Base model (n/s/m/l/x)')
    parser.add_argument('--epochs', type=int, default=100, help='Number of epochs')
    parser.add_argument('--batch', type=int, default=8, help='Batch size (adjust based on VRAM)')
    parser.add_argument('--imgsz', type=int, default=640, help='Image input size')
    
    # ========== 保存相关 ==========
    parser.add_argument('--project', type=str, default='fish_run', help='Project directory')
    parser.add_argument('--name', type=str, default='exp_auto', help='Experiment name')
    
    # ========== 硬件相关 ==========
    parser.add_argument('--device', type=str, default='0', help='Device (0, 1, 2 or cpu)')
    parser.add_argument('--workers', type=int, default=0, help='Dataloader workers (0 for Windows stability)')
    
    # ========== 功能开关 ==========
    parser.add_argument('--resume', action='store_true', help='Resume most recent training')
    
    # ========== 数据增强参数 ==========
    # 几何变换
    parser.add_argument('--degrees', type=float, default=0.0, help='Rotation range in degrees (-180 to 180)')
    parser.add_argument('--translate', type=float, default=0.1, help='Translation fraction (0.0 to 1.0)')
    parser.add_argument('--scale', type=float, default=0.5, help='Scale factor (0.0 to 2.0), 0 means no scale')
    parser.add_argument('--shear', type=float, default=0.0, help='Shear range in degrees')
    parser.add_argument('--perspective', type=float, default=0.0, help='Perspective distortion (0.0 to 0.001)')
    
    # 翻转
    parser.add_argument('--fliplr', type=float, default=0.5, help='Horizontal flip probability (0.0 to 1.0)')
    parser.add_argument('--flipud', type=float, default=0.0, help='Vertical flip probability (0.0 to 1.0)')
    
    # HSV 颜色空间
    parser.add_argument('--hsv_h', type=float, default=0.015, help='HSV Hue augmentation (0.0 to 1.0)')
    parser.add_argument('--hsv_s', type=float, default=0.7, help='HSV Saturation augmentation (0.0 to 1.0)')
    parser.add_argument('--hsv_v', type=float, default=0.4, help='HSV Value augmentation (0.0 to 1.0)')
    
    # 亮度对比度
    parser.add_argument('--brightness', type=float, default=0.0, help='Brightness augmentation (0.0 to 1.0), deprecated use hsv_v')
    parser.add_argument('--contrast', type=float, default=0.0, help='Contrast augmentation (0.0 to 1.0), deprecated')
    
    # 混合增强
    parser.add_argument('--mosaic', type=float, default=1.0, help='Mosaic augmentation probability (0.0 to 1.0)')
    parser.add_argument('--mixup', type=float, default=0.0, help='MixUp augmentation probability (0.0 to 1.0)')
    parser.add_argument('--copy_paste', type=float, default=0.0, help='Copy-paste augmentation probability (0.0 to 1.0)')
    
    # 模糊和噪声
    parser.add_argument('--blur', type=float, default=0.0, help='Gaussian blur probability (0.0 to 1.0)')
    parser.add_argument('--noise', type=float, default=0.0, help='Gaussian noise probability (0.0 to 1.0)')
    
    # 其他
    parser.add_argument('--erasing', type=float, default=0.4, help='Random erasing probability (0.0 to 1.0)')
    parser.add_argument('--crop_fraction', type=float, default=1.0, help='Crop fraction (0.8 to 1.0)')

    args = parser.parse_args()

    train_model(args)
