from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy import text, func
from sqlalchemy.orm import Session
from datetime import datetime

from app.db import engine
from app.dependencies import get_db
from app.models import User, Sensor, Measurement, Device, Alert, AlertRule, MeasurementType
from app.schemas import (
    UserResponse, 
    MeasurementCreate, 
    MeasurementResponse,
    DeviceResponse,
    SensorResponse,
    MeasurementStatsResponse
)

from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
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
def get_devices(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.auth import is_admin
    # Admin sees all devices, regular users see only their own
    if is_admin(user):
        devices = db.query(Device).all()
    else:
        devices = db.query(Device).filter(Device.user_id == user.id).all()
    return devices

@app.get("/sensors", response_model=list[SensorResponse])
def get_sensors(
    device_id: int = None,
    measurement_type_id: int = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.auth import is_admin
    
    # Get devices user has access to
    if is_admin(user):
        devices = db.query(Device).all()
    else:
        devices = db.query(Device).filter(Device.user_id == user.id).all()
    
    allowed_device_ids = [d.id for d in devices]
    
    query = db.query(Sensor).filter(Sensor.device_id.in_(allowed_device_ids))
    if device_id:
        query = query.filter(Sensor.device_id == device_id)
    if measurement_type_id:
        query = query.filter(Sensor.measurement_type_id == measurement_type_id)
    sensors = query.all()
    return sensors

@app.get("/sensors/{sensor_id}", response_model=SensorResponse)
def get_sensor(sensor_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sensor = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return sensor


@app.get("/measurement-types", response_model=list[dict])
def get_measurement_types(db: Session = Depends(get_db)):
    """Get all measurement types."""
    types = db.query(MeasurementType).all()
    return [{"id": t.id, "name": t.name, "unit": t.unit} for t in types]


@app.post("/measurement-types")
def create_measurement_type(
    name: str,
    unit: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.auth import is_admin
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Only admins can create measurement types")
    
    # Check if already exists
    existing = db.query(MeasurementType).filter(MeasurementType.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Measurement type already exists")
    
    mt = MeasurementType(name=name, unit=unit)
    db.add(mt)
    db.commit()
    db.refresh(mt)
    return {"id": mt.id, "name": mt.name, "unit": mt.unit, "message": "Measurement type created"}


@app.post("/devices")
def create_device(
    name: str,
    serial_number: str = None,
    location_name: str = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.auth import is_admin
    # Admin can create for any user, regular users can only create for themselves
    if not is_admin(user):
        # Regular users can only create devices for themselves
        pass  # will use user.id as owner
    
    device = Device(
        name=name,
        serial_number=serial_number,
        location_name=location_name,
        user_id=user.id,
        status="active"
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return {"id": device.id, "name": device.name, "message": "Device created"}


@app.delete("/devices/{device_id}")
def delete_device(
    device_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.auth import is_admin
    
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Check permission: admin can delete any, regular users can only delete their own
    if not is_admin(user) and device.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this device")
    
    # Delete associated sensors first
    db.query(Sensor).filter(Sensor.device_id == device_id).delete()
    db.delete(device)
    db.commit()
    return {"message": "Device deleted"}


@app.post("/sensors")
def create_sensor(
    device_id: int,
    measurement_type_id: int,
    name: str,
    location: str = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.auth import is_admin
    
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Check permission
    if not is_admin(user) and device.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to add sensor to this device")
    
    # Check measurement type exists
    mt = db.query(MeasurementType).filter(MeasurementType.id == measurement_type_id).first()
    if not mt:
        raise HTTPException(status_code=404, detail="Measurement type not found")
    
    sensor = Sensor(
        device_id=device_id,
        measurement_type_id=measurement_type_id,
        name=name,
        location=location
    )
    db.add(sensor)
    db.commit()
    db.refresh(sensor)
    return {"id": sensor.id, "name": sensor.name, "message": "Sensor created"}


@app.delete("/sensors/{sensor_id}")
def delete_sensor(
    sensor_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.auth import is_admin
    
    sensor = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")
    
    device = db.query(Device).filter(Device.id == sensor.device_id).first()
    
    # Check permission
    if not is_admin(user) and device.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this sensor")
    
    db.delete(sensor)
    db.commit()
    return {"message": "Sensor deleted"}


@app.get("/measurement-types/{type_id}")
def get_measurement_type(type_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    mt = db.query(MeasurementType).filter(MeasurementType.id == type_id).first()
    if not mt:
        raise HTTPException(status_code=404, detail="Measurement type not found")
    return {"id": mt.id, "name": mt.name, "unit": mt.unit}

@app.get("/measurements/by-sensor/{sensor_id}", response_model=list[MeasurementResponse])
def get_measurements_by_sensor(
        sensor_id: int, 
        hours: int = 24,
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
        ):
    sensor = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")

    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(hours=hours)

    # Limit to max 500 points for chart performance
    measurements = (
        db.query(Measurement)
        .filter(Measurement.sensor_id == sensor_id)
        .filter(Measurement.ts >= cutoff)
        .order_by(Measurement.ts.asc())
        .limit(500)
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


@app.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"user_id": user.id})

    # Return JSON token AND set cookie for dashboard
    response = JSONResponse(content={"access_token": token, "token_type": "bearer"})
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


@app.get("/my-token")
def get_my_token(request: Request):
    """Get current user's token for API testing."""
    token = request.cookies.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"token": token}


@app.post("/logout")
def logout():
    """Logout - clears the auth cookie."""
    response = RedirectResponse(url="/login-page", status_code=302)
    response.delete_cookie(key="token")
    return response


@app.post("/alert-rules")
def create_rule(
    data: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.auth import is_admin
    
    sensor_id = data.get("sensor_id")
    max_value = data.get("max_value")
    min_value = data.get("min_value")
    
    if not sensor_id:
        raise HTTPException(status_code=400, detail="sensor_id is required")
    
    # Check if sensor exists
    sensor = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")
    
    # Check permission: admin can alert any sensor, regular users only their own
    device = db.query(Device).filter(Device.id == sensor.device_id).first()
    if not is_admin(user) and device.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to create alert for this sensor")
    
    # Create the alert rule
    rule = AlertRule(
        sensor_id=sensor_id,
        max_value=max_value,
        min_value=min_value,
        is_active=True
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    
    return {"id": rule.id, "message": "Alert rule created successfully"}


@app.get("/alert-rules")
def get_alert_rules(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.auth import is_admin
    
    # Get all alert rules
    rules = db.query(AlertRule).all()
    
    # Filter for non-admin users (only their own sensors)
    if not is_admin(user):
        # Get user's device IDs
        user_devices = db.query(Device).filter(Device.user_id == user.id).all()
        user_device_ids = [d.id for d in user_devices]
        # Get sensors for those devices
        user_sensors = db.query(Sensor).filter(Sensor.device_id.in_(user_device_ids)).all()
        user_sensor_ids = [s.id for s in user_sensors]
        # Filter rules
        rules = [r for r in rules if r.sensor_id in user_sensor_ids]
    
    return [
        {
            "id": r.id,
            "sensor_id": r.sensor_id,
            "min_value": r.min_value,
            "max_value": r.max_value,
            "is_active": r.is_active,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in rules
    ]


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard_page(request: Request):
    """Dashboard page - requires authentication via cookie or header."""
    # Check for token in cookies
    token = request.cookies.get("token")
    
    # Also check Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    
    if not token:
        return RedirectResponse(url="/login-page", status_code=302)
    
    db = next(get_db())
    
    try:
        from app.auth import get_current_user
        
        class FakeCredentials:
            credentials = token
        
        user = get_current_user(
            credentials=FakeCredentials(),
            db=db
        )
    except:
        return RedirectResponse(url="/login-page", status_code=302)
    
    from app.auth import is_admin
    
    # Get devices based on user role
    if is_admin(user):
        devices = db.query(Device).filter(Device.status == "active").all()
    else:
        devices = db.query(Device).filter(
            Device.status == "active",
            Device.user_id == user.id
        ).all()
    
    # Get all measurement types
    measurement_types = db.query(MeasurementType).all()
    
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "username": user.first_name,
        "is_admin": is_admin(user),
        "devices": [{"id": d.id, "name": d.name, "location": d.location_name} for d in devices],
        "measurement_types": [{"id": m.id, "name": m.name, "unit": m.unit} for m in measurement_types]
    })


def f_to_c(f):
    return (float(f) - 32) * 5.0 / 9.0


@app.post("/ingest/ecowitt")
async def ingest_ecowitt(request: Request, db: Session = Depends(get_db)):
    """
    Receive data from Ecowitt weather station.
    
    Fully dynamic: maps Ecowitt fields to measurement types by name, then finds
    the corresponding sensor for the given device.
    
    Query params:
    - device_id: which device this data belongs to (required)
    
    The system automatically:
    1. Looks up measurement types by name (temperature, humidity, etc.)
    2. Finds sensors for that device + measurement type
    3. Applies appropriate conversion (F→C for temp, none for humidity)
    """
    form = await request.form()
    data = dict(form)

    # Get device_id from query params
    device_id = request.query_params.get("device_id")
    if not device_id:
        return {"status": "error", "detail": "device_id query parameter is required"}
    
    try:
        device_id = int(device_id)
    except ValueError:
        return {"status": "error", "detail": "device_id must be an integer"}

    # Verify device exists
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        return {"status": "error", "detail": f"Device {device_id} not found"}

    # Get all measurement types from DB
    measurement_types = db.query(MeasurementType).all()
    meas_type_by_name = {mt.name: mt.id for mt in measurement_types}
    
    # Get sensors for this device, indexed by measurement_type_id
    sensors = db.query(Sensor).filter(Sensor.device_id == device_id).all()
    sensors_by_type = {s.measurement_type_id: s.id for s in sensors}

    # Dynamic field-to-measurement-type mapping (by name, not ID)
    # Converter: function to transform the value (None = no conversion)
    ecowitt_field_map = {
        "temp1f": ("temperature", f_to_c),
        "tempinf": ("temperature", f_to_c),
        "humidity1": ("humidity", None),
        "humidityin": ("humidity", None),
        "baromrelin": ("pressure", None),
        "baromabsin": ("pressure", None),
        "wind_speed": ("wind_speed", None),
    }

    try:
        ts = datetime.strptime(data.get("dateutc"), "%Y-%m-%d %H:%M:%S")

        for ecowitt_field, (meas_type_name, converter) in ecowitt_field_map.items():
            # Skip if this field wasn't sent
            if ecowitt_field not in data:
                continue
                
            value = data.get(ecowitt_field)
            if not value:
                continue
            
            # Find measurement type ID by name
            meas_type_id = meas_type_by_name.get(meas_type_name)
            if not meas_type_id:
                print(f"Unknown measurement type: {meas_type_name}")
                continue
            
            # Find sensor for this device + measurement type
            sensor_id = sensors_by_type.get(meas_type_id)
            if not sensor_id:
                print(f"No sensor for device {device_id}, measurement type {meas_type_name}")
                continue
            
            # Convert value if needed
            try:
                if converter:
                    converted_value = converter(value)
                else:
                    converted_value = float(value)
                    
                measurement = Measurement(
                    sensor_id=sensor_id,
                    ts=ts,
                    value=converted_value
                )
                db.add(measurement)
            except (ValueError, TypeError) as ve:
                print(f"Skipping {ecowitt_field}: invalid value {value} - {ve}")

        db.commit()
        return {"status": "ok", "message": "Data ingested successfully"}

    except Exception as e:
        print("Error:", e)
        db.rollback()
        return {"status": "error", "detail": str(e)}