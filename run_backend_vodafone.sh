#!/bin/sh
cd backend
CONFIG=config_iscte.yml flask --app backend.py run -p 5000
