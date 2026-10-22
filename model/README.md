# NutriX food detector (YOLOv8n)

| File | What |
|---|---|
| `model/best.pt` | Trained weights (Ultralytics 8.4.54, trained 2026-05-27, 123 classes, 640 px) |
| `public/models/nutrix-yolov8n.onnx` | ONNX export used by the app (opset 17, simplified, 13.6 MB; input `images` [1,3,640,640], output `output0` [1,127,8400]) |
| `public/ort/` | onnxruntime-web 1.29.0 WASM runtime, served from our own domain |
| `lib/yolo.ts` | Browser inference: letterbox → ONNX → per-class NMS (IoU 0.45, min score 0.25) |
| `lib/yolo-classes.ts` | Class names (training order) and the 32 prepared-dish classes mapped to NutriX dish IDs |

## How the app uses it

1. The photo is resized to 1024 px and run through the detector **on the phone** (the photo doesn't leave the device for this step).
2. Dishes scoring ≥ 0.35 are sent to `/api/analyze` with the photo.
3. With an AI key, the AI sees the detector's guesses as a hint. Without a key, the detector's dishes are shown directly (no more sample thali when it finds something).
4. The person always confirms or edits the list. Raw-ingredient classes (tomato, garlic…) are shown as "ingredients seen", not added.

## Re-export after retraining

```bash
pip install "torch==2.5.1" ultralytics onnx onnxslim   # CPU is enough
yolo export model=model/best.pt format=onnx imgsz=640 opset=17 simplify=True
cp model/best.onnx public/models/nutrix-yolov8n.onnx
```
If the class list changes, regenerate `lib/yolo-classes.ts`.

## Limits (from the capstone evaluation)

51% recall over 123 classes (81.6% mAP@50 on the 31 Indian dishes). It does not estimate portion size. Most classes are raw ingredients; only 32 map to prepared dishes.
