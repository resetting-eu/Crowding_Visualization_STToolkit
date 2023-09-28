#!/bin/sh
cd backend
ENV=local CONFIG=config_vodafone.yml flask --app backend.py run -p 5000
