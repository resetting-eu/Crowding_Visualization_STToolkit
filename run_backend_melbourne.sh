#!/bin/sh
cd backend
ENV=local CONFIG=config_melbourne.yml flask --app backend.py run -p 5002
