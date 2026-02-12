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
            # 开始新训练
            results = model.train(
                data=abs_data_path,
                epochs=args.epochs,
                batch=args.batch,
                imgsz=args.imgsz,
                project=args.project,
                name=args.name,
                device=args.device,
                workers=args.workers,  # Windows下建议设为0
                
                # 【优化4】针对"鱼类关键点"的特调增强参数 (Hardcoded Best Practices)
                # 这些参数是你之前实验成功的关键，固化在脚本里防止遗忘
                degrees=180,      # 鱼可以360度旋转
                fliplr=0.5,       # 左右翻转
                flipud=0.5,       # 上下翻转 (鱼可以肚皮朝上)
                mosaic=1.0,       # 马赛克增强 (对小样本极好)
                scale=0.5,        # 尺寸波动
                
                # 其他实用参数
                exist_ok=True,    # 允许覆盖同名文件夹，不用每次手动改 exp1, exp2
                verbose=True
            )
        
        print(f"✅ 训练完成！最佳模型已保存至: {os.path.join(args.project, args.name, 'weights', 'best.pt')}")
        
    except Exception as e:
        print(f"❌ 训练过程中发生错误: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Train YOLOv8-Pose for Fish Keypoints')
    
    # 基础参数
    parser.add_argument('--data', type=str, default='data.yaml', help='Path to data.yaml')
    parser.add_argument('--model', type=str, default='yolov8s-pose.pt', help='Base model (n/s/m/l/x)')
    parser.add_argument('--epochs', type=int, default=120, help='Number of epochs')
    parser.add_argument('--batch', type=int, default=8, help='Batch size (adjust based on VRAM)')
    parser.add_argument('--imgsz', type=int, default=640, help='Image input size')
    
    # 保存相关
    parser.add_argument('--project', type=str, default='fish_run', help='Project directory')
    parser.add_argument('--name', type=str, default='exp_auto', help='Experiment name')
    
    # 硬件相关
    parser.add_argument('--device', type=str, default='0', help='Device (0, 1, 2 or cpu)')
    parser.add_argument('--workers', type=int, default=0, help='Dataloader workers (0 for Windows stability)')
    
    # 功能开关
    parser.add_argument('--resume', action='store_true', help='Resume most recent training')

    args = parser.parse_args()

    train_model(args)
