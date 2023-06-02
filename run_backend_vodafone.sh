#!/bin/sh
cd backend
CONFIG=config_vodafone.yml flask --app backend.py run -p 5000
