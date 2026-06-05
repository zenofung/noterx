import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DOUBAO_API_KEY: str = ""
    DOUBAO_VISION_ENDPOINT: str = "doubao-1.5-pro-32k"
    DOUBAO_BASE_URL: str = "https://ark.cn-beijing.volces.com/api/v3"
    DATA_DIR: str = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data",
        "video_tasks",
    )
    DOUYIN_COOKIE_FILE: str = ""
    VIDEO_FRAME_INTERVAL_SECONDS: float = 3.0
    VIDEO_SCENE_DETECT_ENABLED: bool = True

    class Config:
        env_file = ".env"


settings = Settings()
