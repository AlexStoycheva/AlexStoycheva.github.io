# Meteo Monitoring System (IoT-Based)

A full-stack web application for collecting, storing, analyzing, and visualizing environmental data from IoT sensors.

This project was developed as a diploma work and demonstrates a complete pipeline from data acquisition to real-time visualization and alerting.

---

## Features

- Data collection from IoT devices (or simulator)
- Persistent storage using PostgreSQL
- Real-time data visualization with charts
- Alert system based on threshold rules
- User authentication (JWT-based)
- Role-based access control (Admin / User)
- Device and sensor management
- Historical data analysis (min, max, avg)

---

## Architecture

The system follows a client-server architecture:

- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL
- **Frontend**: HTML, CSS, JavaScript (Chart.js)
- **ORM**: SQLAlchemy
- **Containerization**: Docker (optional)

---

## System Overview

Main components:
- IoT Device / Data Simulator
- Backend API
- Database
- Web Dashboard (Frontend)

---

## Installation & Setup

1. Clone the repository

```bash
git clone git@github.com:AlexStoycheva/DiplomaWork.git
docker-compose up --build

---

## API Overview

The backend exposes REST endpoints for:

- Devices management
- Sensors management
- Measurements ingestion
- Alerts and rules
- User authentication

Interactive API documentation is available via Swagger UI.

---

## Data Simulation

The system includes a simulator that generates realistic sensor data for testing purposes.
This allows development without requiring physical IoT hardware.

Authentication
JWT-based authentication
Role-based access:
Admin → full control
User → limited to own devices
Alert System
Define min/max thresholds per sensor
Automatic alert triggering
Active alerts + history tracking
Optional email notifications

---

## Technologies Used
- Python
- FastAPI
- PostgreSQL
- SQLAlchemy
- JavaScript (Chart.js)
- HTML/CSS
- Docker

---

## Future Improvements
- Mobile application
- Advanced analytics (anomaly detection)
- Push notifications
- Integration with real IoT hardware
- Cloud deployment (AWS / GCP)

---

# Author

Aleksandra Stoycheva
Technical University of Gabrovo
