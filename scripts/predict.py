import argparse
import sys
import os

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

try:
    import json
    import time
    import signal
    import psutil
    import datetime
    import numpy as np
    import torch
    from pathlib import Path

    os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

    from ultralytics import YOLO
except ImportError as e:
    print(f"ERROR: Failed to import required module: {e}", file=sys.stderr, flush=True)
    import traceback
    print(f"TRACEBACK:\n{traceback.format_exc()}", file=sys.stderr, flush=True)
    sys.stderr.flush()
    sys.exit(1)
except Exception as e:
    print(f"ERROR: Unexpected error during imports: {e}", file=sys.stderr, flush=True)
    import traceback
    print(f"TRACEBACK:\n{traceback.format_exc()}", file=sys.stderr, flush=True)
    sys.stderr.flush()
    sys.exit(1)


class PredictionLogger:
    def __init__(self):
        self.start_time = time.time()

    def _output_json(self, data):
        print('__JSON_LOG__' + json.dumps(data, ensure_ascii=False), flush=True)

    def progress(self, image, index, total):
        self._output_json({
            "event": "progress",
            "image": image,
            "index": index,
            "total": total
        })

    def result(self, image, predictions):
        self._output_json({
            "event": "result",
            "image": image,
            "predictions": predictions
        })

    def complete(self, total, success, failed):
        self._output_json({
            "event": "complete",
            "total": total,
            "success": success,
            "failed": failed
        })

    def error(self, image, error_message):
        self._output_json({
            "event": "error",
            "image": image,
            "error": error_message
        })

    def info(self, message, **context):
        self._output_json({
            "event": "info",
            "message": message,
            "timestamp": datetime.datetime.now().isoformat(),
            **context
        })


prediction_logger = PredictionLogger()

PARENT_PID = os.getppid()
CHECK_INTERVAL = 5
should_stop = False


def check_parent_alive():
    global should_stop
    try:
        if PARENT_PID == 1:
            should_stop = True
            return False

        try:
            parent = psutil.Process(PARENT_PID)
            if not parent.is_running():
                should_stop = True
                return False
        except psutil.NoSuchProcess:
            should_stop = True
            return False
        except psutil.AccessDenied:
            pass

        return True
    except Exception:
        return True


def signal_handler(signum, frame):
    global should_stop
    should_stop = True


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def detect_device(device_arg):
    if device_arg:
        return device_arg

    if torch.cuda.is_available():
        return 'cuda:0'
    return 'cpu'


def parse_images_arg(images_arg):
    if not images_arg:
        return []

    if os.path.isfile(images_arg):
        try:
            with open(images_arg, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if content.startswith('['):
                    return json.loads(content)
                else:
                    return [line.strip() for line in content.split('\n') if line.strip()]
        except Exception:
            return [images_arg]

    try:
        parsed = json.loads(images_arg)
        if isinstance(parsed, list):
            return parsed
        return [parsed]
    except json.JSONDecodeError:
        return [images_arg]


def normalize_bbox(box, img_width, img_height):
    x1, y1, x2, y2 = box
    
    if hasattr(x1, 'item'):
        x1, y1, x2, y2 = x1.item(), y1.item(), x2.item(), y2.item()

    x = float(x1)
    y = float(y1)
    width = float(x2) - float(x1)
    height = float(y2) - float(y1)

    return {
        "x": round(x, 2),
        "y": round(y, 2),
        "width": round(width, 2),
        "height": round(height, 2)
    }


def normalize_keypoints(keypoints_data, img_width, img_height):
    normalized = []

    if keypoints_data is None:
        return normalized

    if hasattr(keypoints_data, 'cpu'):
        keypoints_data = keypoints_data.cpu().numpy()

    for i, kpt in enumerate(keypoints_data):
        if len(kpt) >= 2:
            x_val = kpt[0]
            y_val = kpt[1]
            conf_val = kpt[2] if len(kpt) >= 3 else 1.0
            
            if hasattr(x_val, 'item'):
                x_val = x_val.item()
            if hasattr(y_val, 'item'):
                y_val = y_val.item()
            if hasattr(conf_val, 'item'):
                conf_val = conf_val.item()
            
            x = float(x_val)
            y = float(y_val)
            conf = float(conf_val)

            normalized.append({
                "x": round(x, 2),
                "y": round(y, 2),
                "confidence": round(conf, 6),
                "id": i
            })

    return normalized


def process_image(model, image_path, conf_threshold, output_dir=None):
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found: {image_path}")

    results = model.predict(
        source=image_path,
        conf=conf_threshold,
        verbose=False,
        save=False
    )

    if not results or len(results) == 0:
        return []

    result = results[0]

    img_height, img_width = result.orig_shape

    predictions = []

    boxes = result.boxes
    keypoints = result.keypoints if hasattr(result, 'keypoints') else None

    if boxes is None or len(boxes) == 0:
        return []

    for i in range(len(boxes)):
        box = boxes[i]

        xyxy = box.xyxy[0]
        if hasattr(xyxy, 'cpu'):
            xyxy = xyxy.cpu().numpy()

        conf_val = box.conf
        if hasattr(conf_val, 'cpu'):
            conf_val = conf_val.cpu()
        if hasattr(conf_val, 'numpy'):
            conf_val = conf_val.numpy()
        confidence = float(conf_val.item() if hasattr(conf_val, 'item') else conf_val)
        
        cls_val = box.cls
        if hasattr(cls_val, 'cpu'):
            cls_val = cls_val.cpu()
        if hasattr(cls_val, 'numpy'):
            cls_val = cls_val.numpy()
        class_id = int(cls_val.item() if hasattr(cls_val, 'item') else cls_val)

        bbox_normalized = normalize_bbox(xyxy, img_width, img_height)
        bbox_normalized["confidence"] = round(confidence, 6)
        bbox_normalized["class_id"] = class_id

        kpts_normalized = []
        if keypoints is not None and len(keypoints) > i:
            kpt_data = keypoints.data[i]
            kpts_normalized = normalize_keypoints(kpt_data, img_width, img_height)

        prediction = {
            "bbox": bbox_normalized,
            "keypoints": kpts_normalized
        }

        predictions.append(prediction)

    return predictions


def run_prediction(args):
    global should_stop

    device = detect_device(args.device)
    prediction_logger.info(f"Using device: {device}")

    if not os.path.exists(args.model):
        error_msg = f"Model file not found: {args.model}"
        print(f"ERROR: {error_msg}", file=sys.stderr, flush=True)
        sys.stderr.flush()
        prediction_logger.error("", error_msg)
        prediction_logger.complete(0, 0, 1)
        sys.exit(1)

    prediction_logger.info(f"Loading model: {args.model}")

    try:
        model = YOLO(args.model)
        model.to(device)
    except Exception as e:
        import traceback
        error_msg = f"Failed to load model: {str(e)}"
        traceback_str = traceback.format_exc()
        print(f"ERROR: {error_msg}", file=sys.stderr, flush=True)
        print(f"TRACEBACK:\n{traceback_str}", file=sys.stderr, flush=True)
        sys.stderr.flush()
        prediction_logger.error("", error_msg)
        prediction_logger.complete(0, 0, 1)
        sys.exit(1)

    try:
        image_paths = parse_images_arg(args.images)
    except Exception as e:
        import traceback
        error_msg = f"Failed to parse images argument: {str(e)}"
        traceback_str = traceback.format_exc()
        print(f"ERROR: {error_msg}", file=sys.stderr, flush=True)
        print(f"TRACEBACK:\n{traceback_str}", file=sys.stderr, flush=True)
        print(f"DEBUG: args.images = {args.images[:200] if args.images else 'None'}", file=sys.stderr, flush=True)
        sys.stderr.flush()
        prediction_logger.error("", error_msg)
        prediction_logger.complete(0, 0, 1)
        sys.exit(1)

    if not image_paths:
        error_msg = "No images provided"
        print(f"ERROR: {error_msg}", file=sys.stderr, flush=True)
        print(f"DEBUG: Parsed image_paths = {image_paths}", file=sys.stderr, flush=True)
        sys.stderr.flush()
        prediction_logger.error("", error_msg)
        prediction_logger.complete(0, 0, 1)
        sys.exit(1)

    projects_dir = os.environ.get('PREDICTION_PROJECTS_DIR', '')
    project_id = os.environ.get('PREDICTION_PROJECT_ID', '')

    if projects_dir and project_id:
        uploads_dir = os.path.join(projects_dir, project_id, 'uploads')
        full_paths = []
        
        # 检查uploads目录是否存在
        if not os.path.exists(uploads_dir):
            print(f"WARNING: uploads directory does not exist: {uploads_dir}", file=sys.stderr, flush=True)
            # 尝试创建目录
            try:
                os.makedirs(uploads_dir, exist_ok=True)
                print(f"INFO: Created uploads directory: {uploads_dir}", file=sys.stderr, flush=True)
            except Exception as e:
                print(f"ERROR: Failed to create uploads directory: {e}", file=sys.stderr, flush=True)
        
        # 列出uploads目录中的文件用于调试
        if os.path.exists(uploads_dir):
            try:
                files_in_uploads = os.listdir(uploads_dir)
                print(f"DEBUG: Found {len(files_in_uploads)} files in uploads_dir", file=sys.stderr, flush=True)
                if files_in_uploads:
                    print(f"DEBUG: Sample files: {files_in_uploads[:5]}", file=sys.stderr, flush=True)
            except Exception as e:
                print(f"DEBUG: Failed to list uploads_dir: {e}", file=sys.stderr, flush=True)
        
        print(f"DEBUG: Looking for {len(image_paths)} images", file=sys.stderr, flush=True)
        print(f"DEBUG: Image names: {image_paths[:5] if len(image_paths) > 0 else '[]'}", file=sys.stderr, flush=True)
        
        for img in image_paths:
            img_str = img if isinstance(img, str) else str(img)
            print(f"DEBUG: Processing image: {img_str}", file=sys.stderr, flush=True)
            
            if os.path.isabs(img_str) and os.path.exists(img_str):
                print(f"DEBUG: Found absolute path: {img_str}", file=sys.stderr, flush=True)
                full_paths.append(img_str)
            else:
                full_path = os.path.join(uploads_dir, img_str)
                print(f"DEBUG: Checking: {full_path}", file=sys.stderr, flush=True)
                
                if os.path.exists(full_path):
                    print(f"DEBUG: Found: {full_path}", file=sys.stderr, flush=True)
                    full_paths.append(full_path)
                else:
                    # 尝试不同的扩展名
                    found = False
                    for ext in ['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.JPG', '.JPEG', '.PNG', '.BMP', '.WEBP']:
                        test_path = full_path.rsplit('.', 1)[0] + ext if '.' in full_path else full_path + ext
                        if os.path.exists(test_path):
                            print(f"DEBUG: Found with extension {ext}: {test_path}", file=sys.stderr, flush=True)
                            full_paths.append(test_path)
                            found = True
                            break
                    
                    if not found:
                        print(f"WARNING: Image not found: {img_str} (checked {full_path} and variants)", file=sys.stderr, flush=True)
        
        image_paths = full_paths
        print(f"DEBUG: Resolved {len(image_paths)} image paths", file=sys.stderr, flush=True)

    if not image_paths:
        error_msg = "No valid image paths found"
        print(f"ERROR: {error_msg}", file=sys.stderr, flush=True)
        print(f"DEBUG: projects_dir = {projects_dir}, project_id = {project_id}", file=sys.stderr, flush=True)
        uploads_dir_path = os.path.join(projects_dir, project_id, 'uploads') if (projects_dir and project_id) else 'N/A'
        print(f"DEBUG: uploads_dir = {uploads_dir_path}", file=sys.stderr, flush=True)
        if projects_dir and project_id:
            uploads_dir_full = os.path.join(projects_dir, project_id, 'uploads')
            exists = os.path.exists(uploads_dir_full)
            print(f"DEBUG: uploads_dir exists = {exists}", file=sys.stderr, flush=True)
            if exists:
                files = os.listdir(uploads_dir_full)
                print(f"DEBUG: files in uploads_dir = {files[:10]}", file=sys.stderr, flush=True)
        print(f"DEBUG: Original image_paths before path resolution = {image_paths}", file=sys.stderr, flush=True)
        sys.stderr.flush()
        prediction_logger.error("", error_msg)
        prediction_logger.complete(0, 0, 1)
        sys.exit(1)

    total = len(image_paths)
    success_count = 0
    failed_count = 0

    prediction_logger.info(f"Starting prediction for {total} images")

    if args.output:
        os.makedirs(args.output, exist_ok=True)

    for index, image_path in enumerate(image_paths):
        if should_stop:
            prediction_logger.info("Prediction cancelled by user")
            break

        if not check_parent_alive():
            prediction_logger.info("Parent process exited, stopping prediction")
            break

        image_name = os.path.basename(image_path)
        prediction_logger.progress(image_name, index, total)

        try:
            predictions = process_image(model, image_path, args.conf, args.output)

            prediction_logger.result(image_name, predictions)

            if args.output and predictions:
                output_file = os.path.join(
                    args.output,
                    os.path.splitext(image_name)[0] + ".json"
                )
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump({
                        "image": image_name,
                        "image_path": image_path,
                        "predictions": predictions
                    }, f, indent=2, ensure_ascii=False)

            success_count += 1

        except Exception as e:
            import traceback
            error_details = f"{str(e)}\nTraceback: {traceback.format_exc()}"
            prediction_logger.error(image_name, error_details)
            failed_count += 1

    prediction_logger.complete(total, success_count, failed_count)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='YOLO Pose Model Prediction for Pre-annotation')

    parser.add_argument(
        '--model',
        type=str,
        required=True,
        help='Path to model file (.pt)'
    )
    parser.add_argument(
        '--images',
        type=str,
        default='',
        help='Image paths as JSON string or file path containing image paths'
    )
    parser.add_argument(
        '--output',
        type=str,
        default='',
        help='Output directory for prediction results'
    )
    parser.add_argument(
        '--conf',
        type=float,
        default=0.5,
        help='Confidence threshold (default: 0.5)'
    )
    parser.add_argument(
        '--device',
        type=str,
        default='',
        help='Device to use (default: auto-detect)'
    )
    parser.add_argument(
        '--mode',
        type=str,
        default='all',
        help='Prediction mode: all, unannotated, selected'
    )

    args = parser.parse_args()

    if not args.images:
        args.images = os.environ.get('PREDICTION_IMAGES', '')

    if not args.images:
        error_msg = "No images provided via --images or PREDICTION_IMAGES env"
        print(f"ERROR: {error_msg}", file=sys.stderr, flush=True)
        env_value = os.environ.get('PREDICTION_IMAGES', 'NOT SET')
        print(f"DEBUG: PREDICTION_IMAGES env = {env_value[:500] if len(str(env_value)) > 500 else env_value}", file=sys.stderr, flush=True)
        sys.stderr.flush()
        prediction_logger.error("", error_msg)
        prediction_logger.complete(0, 0, 1)
        sys.exit(1)

    run_prediction(args)
