#!/bin/sh
cd backend
CONFIG=config_melbourne.yml flask --app backend.py run -p 5002
