from sqlalchemy import Column, Integer, BigInteger, String, Boolean, ForeignKey, TIMESTAMP, Numeric
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db import Base

class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)

    users = relationship("UserRole", back_populates="role")

class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, index=True)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    first_name = Column(String(50))
    last_name = Column(String(50))
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    roles = relationship("UserRole", back_populates="user")

class UserRole(Base):
    __tablename__ = "user_roles"

    user_id = Column(BigInteger, ForeignKey("users.id"), primary_key=True)
    role_id = Column(Integer, ForeignKey("roles.id"), primary_key=True)

    user = relationship("User", back_populates="roles")
    role = relationship("Role", back_populates="users")

class Device(Base):
    __tablename__ = "devices"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    serial_number = Column(String(100), unique=True)
    location_name = Column(String(100))
    status = Column(String(20), default="active")
    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    sensors = relationship("Sensor", back_populates="device")

class MeasurementType(Base):
    __tablename__ = "measurement_types"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    unit = Column(String(20), nullable=False)

    sensors = relationship("Sensor", back_populates="measurement_type")

class Sensor(Base):
    __tablename__ = "sensors"

    id = Column(BigInteger, primary_key=True, index=True)
    device_id = Column(BigInteger, ForeignKey("devices.id"))
    measurement_type_id = Column(BigInteger, ForeignKey("measurement_types.id"))
    name = Column(String(100))
    location = Column(String(20))
    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    device = relationship("Device", back_populates="sensors")
    measurement_type = relationship("MeasurementType", back_populates="sensors")
    measurements = relationship("Measurement", back_populates="sensor")

class Measurement(Base):
    __tablename__ = "measurements"

    id = Column(BigInteger, primary_key=True, index=True)
    sensor_id = Column(BigInteger, ForeignKey("sensors.id"))
    ts = Column(TIMESTAMP, nullable=False)
    value = Column(Numeric(10, 2), nullable=False)

    sensor = relationship("Sensor", back_populates="measurements")