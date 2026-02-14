import argparse
import sys
import os
import json

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

from ultralytics import YOLO

def log_json(data):
    print(f"__JSON_LOG__{json.dumps(data)}", flush=True)

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

def train_model(args):
    try:
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
                exist_ok=True,
                verbose=True
            )

        best_model_path = os.path.join(args.project, args.name, 'weights', 'best.pt')
        print(f"✅ 训练完成！最佳模型已保存至: {best_model_path}")
        log_json({
            "event": "train_complete",
            "best_model": best_model_path
        })

    except Exception as e:
        print(f"❌ 训练过程中发生错误: {e}", file=sys.stderr)
        log_json({
            "event": "error",
            "message": str(e),
            "type": "exception"
        })
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Train YOLOv8-Pose for Fish Keypoints')

    parser.add_argument('--data', type=str, default='data.yaml', help='Path to data.yaml')
    parser.add_argument('--model', type=str, default='yolov8s-pose.pt', help='Base model')
    parser.add_argument('--epochs', type=int, default=100, help='Number of epochs')
    parser.add_argument('--batch', type=int, default=8, help='Batch size')
    parser.add_argument('--imgsz', type=int, default=640, help='Image input size')

    parser.add_argument('--project', type=str, default='fish_run', help='Project directory')
    parser.add_argument('--name', type=str, default='exp_auto', help='Experiment name')

    parser.add_argument('--device', type=str, default='0', help='Device (0, 1, 2 or cpu)')
    parser.add_argument('--workers', type=int, default=0, help='Dataloader workers')

    parser.add_argument('--resume', action='store_true', help='Resume most recent training')

    parser.add_argument('--degrees', type=float, default=0.0, help='Rotation range')
    parser.add_argument('--translate', type=float, default=0.1, help='Translation fraction')
    parser.add_argument('--scale', type=float, default=0.5, help='Scale factor')
    parser.add_argument('--shear', type=float, default=0.0, help='Shear range')
    parser.add_argument('--perspective', type=float, default=0.0, help='Perspective distortion')

    parser.add_argument('--fliplr', type=float, default=0.5, help='Horizontal flip probability')
    parser.add_argument('--flipud', type=float, default=0.0, help='Vertical flip probability')

    parser.add_argument('--hsv_h', type=float, default=0.015, help='HSV Hue augmentation')
    parser.add_argument('--hsv_s', type=float, default=0.7, help='HSV Saturation augmentation')
    parser.add_argument('--hsv_v', type=float, default=0.4, help='HSV Value augmentation')

    parser.add_argument('--mosaic', type=float, default=1.0, help='Mosaic augmentation probability')
    parser.add_argument('--mixup', type=float, default=0.0, help='MixUp augmentation probability')
    parser.add_argument('--copy_paste', type=float, default=0.0, help='Copy-paste augmentation probability')

    parser.add_argument('--erasing', type=float, default=0.4, help='Random erasing probability')
    parser.add_argument('--crop_fraction', type=float, default=1.0, help='Crop fraction')

    args = parser.parse_args()

    train_model(args)
