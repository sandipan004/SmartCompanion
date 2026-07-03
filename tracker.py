import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import numpy as np
import cv2

BaseOptions = mp.tasks.BaseOptions

# Load models safely (they might throw if files are missing, which is expected)
def init_tracker():
    try:
        hand_options = vision.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path='tasks/hand_landmarker.task'),
            num_hands=2)
        hand_landmarker = vision.HandLandmarker.create_from_options(hand_options)

        face_options = vision.FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path='tasks/face_landmarker.task'),
            output_face_blendshapes=True,
            num_faces=1)
        face_landmarker = vision.FaceLandmarker.create_from_options(face_options)

        pose_options = vision.PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path='tasks/pose_landmarker_lite.task'))
        pose_landmarker = vision.PoseLandmarker.create_from_options(pose_options)

        obj_options = vision.ObjectDetectorOptions(
            base_options=BaseOptions(model_asset_path='tasks/efficientdet_lite0.tflite'),
            max_results=5,
            score_threshold=0.5)
        object_detector = vision.ObjectDetector.create_from_options(obj_options)
        
        return hand_landmarker, face_landmarker, pose_landmarker, object_detector
    except Exception as e:
        print(f"Error initializing trackers: {e}")
        return None, None, None, None

hand_landmarker, face_landmarker, pose_landmarker, object_detector = None, None, None, None

def process_frame(image_bytes: bytes) -> dict:
    global hand_landmarker, face_landmarker, pose_landmarker, object_detector
    
    if not hand_landmarker:
        hand_landmarker, face_landmarker, pose_landmarker, object_detector = init_tracker()
        if not hand_landmarker:
            return {}

    nparr = np.frombuffer(image_bytes, np.uint8)
    img_np = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img_np is None:
        return {}

    img_rgb = cv2.cvtColor(img_np, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)

    # 1. Hands
    hand_result = hand_landmarker.detect(mp_image)
    hands = []
    if hand_result.hand_landmarks:
        for landmarks in hand_result.hand_landmarks:
            hands.append([{"x": lm.x, "y": lm.y, "z": lm.z} for lm in landmarks])

    # 2. Face & Gaze
    face_result = face_landmarker.detect(mp_image)
    faces = []
    gaze_direction = "center"
    if face_result.face_landmarks:
        for landmarks in face_result.face_landmarks:
            faces.append([{"x": lm.x, "y": lm.y, "z": lm.z} for lm in landmarks])
            
        if face_result.face_blendshapes:
            blendshapes = face_result.face_blendshapes[0]
            look_left = next((b.score for b in blendshapes if b.category_name == "eyeLookInLeft"), 0)
            look_right = next((b.score for b in blendshapes if b.category_name == "eyeLookOutLeft"), 0)
            if look_left > 0.5:
                gaze_direction = "right"
            elif look_right > 0.5:
                gaze_direction = "left"

    # 3. Pose
    pose_result = pose_landmarker.detect(mp_image)
    poses = []
    if pose_result.pose_landmarks:
        for landmarks in pose_result.pose_landmarks:
            poses.append([{"x": lm.x, "y": lm.y, "z": lm.z} for lm in landmarks])

    # 4. Objects
    obj_result = object_detector.detect(mp_image)
    objects = []
    if obj_result.detections:
        for detection in obj_result.detections:
            bbox = detection.bounding_box
            category = detection.categories[0]
            objects.append({
                "name": category.category_name,
                "score": category.score,
                "x": bbox.origin_x,
                "y": bbox.origin_y,
                "width": bbox.width,
                "height": bbox.height
            })

    return {
        "hands": hands,
        "faces": faces,
        "poses": poses,
        "objects": objects,
        "gaze": gaze_direction
    }
