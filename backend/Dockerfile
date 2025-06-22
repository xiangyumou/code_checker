# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set the working directory in the container
WORKDIR /app

# Install system dependencies if needed (e.g., for database drivers)
# RUN apt-get update && apt-get install -y --no-install-recommends some-package && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
# Copy only requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY ./app /app/app
COPY alembic.ini /app/
COPY alembic /app/alembic/

# Expose the port the app runs on
EXPOSE 8000

# Define the command to run the application
# Use gunicorn for production, uvicorn for development/simpler setups
# For development with reload: CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
# Run migrations before starting the server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]