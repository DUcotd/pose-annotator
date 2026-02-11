import argparse
import sys
import os
from ultralytics import YOLO

def train_model(data_path, model_name, epochs, batch_size, imgsz, project_dir, name, device):
    try:
        # Load a model
        model = YOLO(model_name)  # load a pretrained model (recommended for training)

        # Train the model
        results = model.train(
            data=data_path,
            epochs=epochs,
            batch=batch_size,
            imgsz=imgsz,
            project=project_dir,
            name=name,
            device=device,
            verbose=True
        )
        
        print("Training completed successfully.")
        
    except Exception as e:
        print(f"Error during training: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Train YOLOv8 model')
    parser.add_argument('--data', type=str, required=True, help='Path to data.yaml')
    parser.add_argument('--model', type=str, default='yolov8n.pt', help='Model to start from')
    parser.add_argument('--epochs', type=int, default=100, help='Number of epochs')
    parser.add_argument('--batch', type=int, default=16, help='Batch size')
    parser.add_argument('--imgsz', type=int, default=640, help='Image size')
    parser.add_argument('--project', type=str, required=True, help='Project directory for saving results')
    parser.add_argument('--name', type=str, default='train', help='Name of the training run')
    parser.add_argument('--device', type=str, default='0', help='Device to use (cpu, 0, 0,1, etc.)')

    args = parser.parse_args()

    train_model(
        args.data,
        args.model,
        args.epochs,
        args.batch,
        args.imgsz,
        args.project,
        args.name,
        args.device
    )
