import os
import shutil

def resolve_binary_path(binary_name: str) -> str:
    """
    Finds the path to a binary (like ffmpeg or ffprobe).
    Checks the standard system PATH first, then falls back to Windows winget directory if on Windows.
    """
    # 1. Check if it is in standard PATH
    path_bin = shutil.which(binary_name)
    if path_bin:
        return path_bin

    # 2. Check in winget packages path dynamically (on Windows)
    if os.name == "nt":
        home = os.path.expanduser("~")
        winget_packages_dir = os.path.join(home, "AppData", "Local", "Microsoft", "WinGet", "Packages")
        if os.path.isdir(winget_packages_dir):
            # Look for Gyan.FFmpeg folder
            for item in os.listdir(winget_packages_dir):
                if "Gyan.FFmpeg" in item:
                    full_build_dir = os.path.join(winget_packages_dir, item)
                    if os.path.isdir(full_build_dir):
                        for subitem in os.listdir(full_build_dir):
                            if subitem.startswith("ffmpeg-") and "build" in subitem:
                                bin_path = os.path.join(full_build_dir, subitem, "bin", f"{binary_name}.exe")
                                if os.path.isfile(bin_path):
                                    return bin_path
                            
    # Return default name if not found
    return binary_name
