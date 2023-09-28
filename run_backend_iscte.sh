#!/bin/sh
cd backend
ENV=local CONFIG=config_iscte.yml flask --app backend.py run -p 5001
