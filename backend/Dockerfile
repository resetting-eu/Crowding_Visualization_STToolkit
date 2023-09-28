# Use an official Python runtime as a parent image
FROM python:3.11.5

# Set the working directory in the container
WORKDIR /backend

# Install uWSGI
RUN pip install uwsgi==2.0.22

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all local files into the image
COPY . .

# Expose the port that uWSGI will use
EXPOSE 5000

# Command to start the uWSGI server
CMD ["uwsgi", "-w", "backend:app", "-s", ":5000"]
