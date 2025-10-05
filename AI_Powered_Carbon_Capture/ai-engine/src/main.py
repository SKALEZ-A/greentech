"""
AI Engine API Server for Carbon Capture Network

This module provides a FastAPI server for AI-powered carbon capture optimization,
predictive maintenance, and efficiency prediction services.
"""

import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
import logging
import json
from datetime import datetime
import asyncio
from concurrent.futures import ThreadPoolExecutor
import pandas as pd

from models.optimization_model import CarbonCaptureOptimizer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Carbon Capture AI Engine",
    description="AI-powered optimization services for carbon capture network",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000"],  # Frontend and backend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global optimizer instance
optimizer = CarbonCaptureOptimizer()

# Thread pool for CPU-intensive tasks
executor = ThreadPoolExecutor(max_workers=4)

# Pydantic models for API
class SensorData(BaseModel):
    temperature: float = Field(..., description="Operating temperature in Celsius")
    pressure: float = Field(..., description="System pressure in kPa")
    flow_rate: float = Field(..., description="Air flow rate in m³/h")
    humidity: float = Field(..., description="Relative humidity percentage")
    air_quality: float = Field(..., description="Air quality index")
    energy_consumption: float = Field(..., description="Energy consumption in kWh")
    co2_concentration: float = Field(..., description="CO2 concentration in ppm")
    unit_age_days: Optional[int] = Field(None, description="Unit age in days")
    maintenance_days_since: Optional[int] = Field(None, description="Days since last maintenance")
    efficiency_current: Optional[float] = Field(None, description="Current efficiency percentage")

class OperationalData(BaseModel):
    energy_consumption: float = Field(..., description="Current energy consumption in kWh")
    renewable_energy_available: float = Field(..., description="Available renewable energy percentage")
    renewable_usage: float = Field(..., description="Current renewable energy usage percentage")
    grid_usage: float = Field(..., description="Current grid energy usage percentage")
    peak_hours: bool = Field(False, description="Whether currently in peak hours")

class OptimizationRequest(BaseModel):
    unit_id: str = Field(..., description="Carbon capture unit identifier")
    sensor_data: SensorData
    operational_data: Optional[OperationalData] = None

class TrainingData(BaseModel):
    features: List[Dict[str, Any]] = Field(..., description="Training features")
    targets: List[Dict[str, Any]] = Field(..., description="Training targets")

class ModelHealthResponse(BaseModel):
    overall_status: str
    models: Dict[str, Any]
    version: str
    last_check: str

# API Routes
@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "Carbon Capture AI Engine API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "carbon-capture-ai-engine"
    }

@app.get("/model-health", response_model=ModelHealthResponse)
async def get_model_health():
    """Get the health status of all AI models."""
    try:
        health = await asyncio.get_event_loop().run_in_executor(
            executor, optimizer.get_model_health
        )
        return ModelHealthResponse(**health)
    except Exception as e:
        logger.error(f"Error getting model health: {e}")
        raise HTTPException(status_code=500, detail="Failed to get model health")

@app.post("/optimize/efficiency")
async def optimize_efficiency(request: OptimizationRequest):
    """
    Optimize carbon capture efficiency for a given unit.

    This endpoint uses AI models to predict optimal operating parameters
    and provide efficiency optimization suggestions.
    """
    try:
        # Convert request data to dict
        sensor_dict = request.sensor_data.dict()

        # Run optimization in thread pool to avoid blocking
        result = await asyncio.get_event_loop().run_in_executor(
            executor, optimizer.predict_efficiency, sensor_dict
        )

        # Add request metadata
        result.update({
            "unit_id": request.unit_id,
            "request_timestamp": datetime.now().isoformat(),
            "processing_time_ms": 0  # Could be measured
        })

        logger.info(f"Efficiency optimization completed for unit {request.unit_id}")
        return result

    except Exception as e:
        logger.error(f"Error in efficiency optimization: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Efficiency optimization failed: {str(e)}"
        )

@app.post("/predict/maintenance")
async def predict_maintenance(request: OptimizationRequest):
    """
    Predict maintenance needs for a carbon capture unit.

    Uses predictive maintenance models to forecast when maintenance
    will be required and identify potential issues.
    """
    try:
        sensor_dict = request.sensor_data.dict()

        result = await asyncio.get_event_loop().run_in_executor(
            executor, optimizer.predict_maintenance, sensor_dict
        )

        result.update({
            "unit_id": request.unit_id,
            "request_timestamp": datetime.now().isoformat()
        })

        logger.info(f"Maintenance prediction completed for unit {request.unit_id}")
        return result

    except Exception as e:
        logger.error(f"Error in maintenance prediction: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Maintenance prediction failed: {str(e)}"
        )

@app.post("/optimize/energy")
async def optimize_energy(request: OptimizationRequest):
    """
    Optimize energy usage for carbon capture operations.

    Provides recommendations for energy consumption reduction and
    renewable energy integration.
    """
    try:
        if not request.operational_data:
            raise HTTPException(
                status_code=400,
                detail="Operational data required for energy optimization"
            )

        operational_dict = request.operational_data.dict()

        result = await asyncio.get_event_loop().run_in_executor(
            executor, optimizer.optimize_energy_usage, operational_dict
        )

        result.update({
            "unit_id": request.unit_id,
            "request_timestamp": datetime.now().isoformat()
        })

        logger.info(f"Energy optimization completed for unit {request.unit_id}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in energy optimization: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Energy optimization failed: {str(e)}"
        )

@app.post("/train/efficiency")
async def train_efficiency_model(data: TrainingData, background_tasks: BackgroundTasks):
    """
    Train the efficiency prediction model with new data.

    This is a background task that may take significant time to complete.
    """
    try:
        # Convert training data to DataFrame
        df = pd.DataFrame(data.features)

        # Add target columns if provided
        if data.targets:
            targets_df = pd.DataFrame(data.targets)
            df = pd.concat([df, targets_df], axis=1)

        # Start training in background
        background_tasks.add_task(train_efficiency_background, df)

        return {
            "message": "Efficiency model training started",
            "status": "training",
            "estimated_duration": "10-30 minutes",
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Error starting efficiency training: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Training initialization failed: {str(e)}"
        )

@app.post("/train/maintenance")
async def train_maintenance_model(data: TrainingData, background_tasks: BackgroundTasks):
    """
    Train the predictive maintenance model with new data.
    """
    try:
        df = pd.DataFrame(data.features)
        if data.targets:
            targets_df = pd.DataFrame(data.targets)
            df = pd.concat([df, targets_df], axis=1)

        background_tasks.add_task(train_maintenance_background, df)

        return {
            "message": "Maintenance model training started",
            "status": "training",
            "estimated_duration": "5-15 minutes",
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Error starting maintenance training: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Training initialization failed: {str(e)}"
        )

@app.post("/models/save")
async def save_models():
    """Save current models to disk."""
    try:
        await asyncio.get_event_loop().run_in_executor(
            executor, optimizer.save_models
        )

        return {
            "message": "Models saved successfully",
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Error saving models: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Model saving failed: {str(e)}"
        )

@app.post("/models/load")
async def load_models():
    """Load models from disk."""
    try:
        await asyncio.get_event_loop().run_in_executor(
            executor, optimizer.load_models
        )

        return {
            "message": "Models loaded successfully",
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Error loading models: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Model loading failed: {str(e)}"
        )

# Background training functions
def train_efficiency_background(data: pd.DataFrame):
    """Background task for training efficiency model."""
    try:
        logger.info("Starting efficiency model training in background")

        results = optimizer.train_efficiency_model(data)

        # Save models after training
        optimizer.save_models()

        logger.info(f"Efficiency model training completed: {results}")

    except Exception as e:
        logger.error(f"Efficiency model training failed: {e}")
        raise

def train_maintenance_background(data: pd.DataFrame):
    """Background task for training maintenance model."""
    try:
        logger.info("Starting maintenance model training in background")

        results = optimizer.train_predictive_maintenance(data)

        # Save models after training
        optimizer.save_models()

        logger.info(f"Maintenance model training completed: {results}")

    except Exception as e:
        logger.error(f"Maintenance model training failed: {e}")
        raise

# Startup and shutdown handlers
@app.on_event("startup")
async def startup_event():
    """Initialize the AI engine on startup."""
    logger.info("Starting Carbon Capture AI Engine...")

    try:
        # Try to load existing models
        await asyncio.get_event_loop().run_in_executor(
            executor, optimizer.load_models
        )
        logger.info("Existing models loaded successfully")

    except Exception as e:
        logger.warning(f"Could not load existing models: {e}")
        logger.info("Starting with untrained models")

    logger.info("Carbon Capture AI Engine started successfully")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown."""
    logger.info("Shutting down Carbon Capture AI Engine...")

    # Save models before shutdown
    try:
        await asyncio.get_event_loop().run_in_executor(
            executor, optimizer.save_models
        )
        logger.info("Models saved before shutdown")

    except Exception as e:
        logger.error(f"Error saving models on shutdown: {e}")

    # Shutdown thread pool
    executor.shutdown(wait=True)
    logger.info("Carbon Capture AI Engine shut down successfully")

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handle HTTP exceptions with consistent format."""
    return {
        "error": {
            "code": exc.status_code,
            "message": exc.detail,
            "timestamp": datetime.now().isoformat()
        }
    }

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle general exceptions."""
    logger.error(f"Unhandled exception: {exc}")
    return {
        "error": {
            "code": 500,
            "message": "Internal server error",
            "timestamp": datetime.now().isoformat()
        }
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5000,
        reload=True,
        log_level="info"
    )
