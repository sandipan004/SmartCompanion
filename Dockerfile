# Use an official PyTorch runtime as a parent image (includes Python and CUDA)
FROM pytorch/pytorch:2.4.0-cuda12.1-cudnn9-runtime

# Set environment variables to avoid interactive prompts during apt-get
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install system dependencies (required for OpenCV and MediaPipe)
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libgles2-mesa \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install Python dependencies
# We already have torch and torchvision from the base image, so we upgrade the rest
RUN pip install --no-cache-dir --default-timeout=100 -r requirements.txt

# Copy the rest of the backend files (including the /tasks directory with MediaPipe models)
COPY . .

# Expose port 7860 for Hugging Face Spaces
EXPOSE 7860

# Command to run the application
# We bind to 0.0.0.0 so it is accessible outside the container
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
