from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy import text, func
from sqlalchemy.orm import Session
from datetime import datetime

from app.db import engine
from app.dependencies import get_db
from app.models import User, Sensor, Measurement, Device, Alert, AlertRule
from app.schemas import (
    UserResponse, 
    MeasurementCreate, 
    MeasurementResponse,
    DeviceResponse,
    SensorResponse,
    MeasurementStatsResponse
)

from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from fastapi import Request
from fastapi import Response

from app.auth import verify_password, create_access_token
from app.schemas import LoginRequest, TokenResponse
from app.auth import get_current_user, is_admin

from fastapi.staticfiles import StaticFiles


templates = Jinja2Templates(directory="app/templates")

app = FastAPI(title="Meteo Monitoring API", version="1.0.0")
app.mount("/static", StaticFiles(directory="app/static"), name="static")

@app.get("/", response_class=HTMLResponse)
def read_root(request: Request):
    """Root route - redirects to dashboard if authenticated, otherwise to login."""
    # Check for token in cookies or Authorization header
    token = request.cookies.get("token")
    
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    
    if token:
        try:
            from app.auth import get_current_user
            from fastapi.security import HTTPAuthorizationCredentials
            
            class FakeCredentials:
                credentials = token
            
            # Try to validate the token
            user = get_current_user(
                credentials=FakeCredentials(),
                db=next(get_db())
            )
            if user:
                # Authenticated - redirect to dashboard
                from fastapi.responses import RedirectResponse
                return RedirectResponse(url="/dashboard", status_code=302)
        except:
            pass
    
    # Not authenticated - redirect to login
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/login-page", status_code=302)

@app.get("/health/db")
def check_db():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        value = result.scalar()
        return {"database": "ok", "result": value}

@app.get("/users", response_model=list[UserResponse])
def get_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return users

@app.post("/measurements", response_model=MeasurementResponse)
def create_measurement(payload: MeasurementCreate, db: Session = Depends(get_db)):
    sensor = db.query(Sensor).filter(Sensor.id == payload.sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")

    measurement = Measurement(
        sensor_id=payload.sensor_id, 
        ts=payload.ts, 
        value=payload.value
    )
    db.add(measurement)
    db.commit()
    db.refresh(measurement)

    rules = (
        db.query(AlertRule)
        .filter(
            AlertRule.sensor_id == payload.sensor_id,
            AlertRule.is_active == True
        )
        .all()
    )

    for rule in rules:
        triggered = False

        if rule.min_value is not None and payload.value < rule.min_value:
            triggered = True

        if rule.max_value is not None and payload.value > rule.max_value:
            triggered = True

        active_alert = (
            db.query(Alert)
            .filter(
                Alert.alert_rule_id == rule.id,
                Alert.status == "active"
            )
            .first()
        )

        if triggered:
            if not active_alert:
                alert = Alert(
                    alert_rule_id=rule.id,
                    measurement_id=measurement.id,
                    message=f"Threshold exceeded: {payload.value}",
                    severity="high",
                    status="active"
                )
                db.add(alert)
                db.commit()

        else:
            if active_alert:
                active_alert.status = "resolved"
                active_alert.resolved_at = datetime.utcnow()
                db.commit()
    
    return measurement

@app.get("/measurements", response_model=list[MeasurementResponse])
def get_measurements(db: Session = Depends(get_db)):
    measurements = db.query(Measurement).all()
    return measurements

@app.get("/devices", response_model=list[DeviceResponse])
def get_devices(db: Session = Depends(get_db)):
    devices = db.query(Device).all()
    return devices

@app.get("/sensors", response_model=list[SensorResponse])
def get_sensors(db: Session = Depends(get_db)):
    sensors = db.query(Sensor).all()
    return sensors

@app.get("/measurements/by-sensor/{sensor_id}", response_model=list[MeasurementResponse])
def get_measurements_by_sensor(
        sensor_id: int, 
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
        ):
    sensor = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")

    measurements = (
        db.query(Measurement)
        .filter(Measurement.sensor_id == sensor_id)
        .order_by(Measurement.ts.desc())
        .limit(100)
        .all()
    )
    return measurements

@app.get("/measurements/stats/{sensor_id}", response_model=MeasurementStatsResponse)
def get_measurement_stats(sensor_id: int, db: Session = Depends(get_db)):
    sensor = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")

    result = (
        db.query(
            func.min(Measurement.value),
            func.max(Measurement.value),
            func.avg(Measurement.value),
        )
        .filter(Measurement.sensor_id == sensor_id)
        .first()
    )

    return MeasurementStatsResponse(
        sensor_id=sensor_id,
        min_value=float(result[0]) if result[0] is not None else None,
        max_value=float(result[1]) if result[1] is not None else None,
        avg_value=float(result[2]) if result[2] is not None else None,
    )


@app.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"user_id": user.id})

    response = RedirectResponse(url="/dashboard", status_code=302)
    response.set_cookie(key="token", value=token, httponly=True, samesite="lax")
    return response


@app.get("/login-page", response_class=HTMLResponse)
def login_page(request: Request):
    """Login page - serves the login form."""
    return templates.TemplateResponse("login.html", {
        "request": request
    })


@app.get("/me")
def get_me(user: User = Depends(get_current_user)):
    return {
        "email": user.email,
        "roles": [r.role.name for r in user.roles]
    }


@app.post("/alert-rules")
def create_rule(
    data: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Not enough permissions")


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard_page(request: Request, user: User = Depends(get_current_user)):
    """Dashboard page - requires authentication."""
    return templates.TemplateResponse("dashboard.html", {
        "request": request
    })
    

@app.post("/ingest/ecowitt")
async def ingest_ecowitt(request: Request, db: Session = Depends(get_db)):
    """Ingest data from Ecowitt weather stations."""
    data = await request.form()
    print(data)

    return {"status": "ok"}