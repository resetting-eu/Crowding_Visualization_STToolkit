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

# Used to ensure the backend is run only after mariadb connection is available
RUN chmod a+x wait-for-it.sh

# Command to start the uWSGI server
CMD ["./wait-for-it.sh", "mariadb:3306", "--", "uwsgi", "-w", "backend:app", "-s", ":5000"]
