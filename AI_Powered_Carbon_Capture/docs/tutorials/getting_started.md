# Getting Started with Carbon Capture Network

Welcome to the Carbon Capture Network! This guide will help you get started with setting up and using the AI-powered carbon capture and storage platform.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 16 or higher)
- **Python** (version 3.8 or higher)
- **MongoDB** (version 4.4 or higher)
- **Redis** (version 6.0 or higher)
- **Docker** (optional, for containerized deployment)
- **Git** (for cloning the repository)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/carbon-capture-network.git
cd carbon-capture-network
```

### 2. Environment Setup

Copy the sample environment configuration:

```bash
cp config/environments/sample.env .env
```

Edit the `.env` file with your configuration:

```bash
# Database
MONGODB_URI=mongodb://localhost:27017/carbon-capture
REDIS_URL=redis://localhost:6379

# JWT Secret (generate a secure random string)
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Email configuration (optional)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### 3. Install Dependencies

#### Backend Dependencies
```bash
cd backend
npm install
```

#### AI Engine Dependencies
```bash
cd ../ai-engine
pip install -r requirements.txt
```

#### Frontend Dependencies
```bash
cd ../frontend
npm install
```

### 4. Start Services

#### Start MongoDB and Redis
```bash
# Using Docker (recommended)
docker run -d -p 27017:27017 --name mongodb mongo:5.0
docker run -d -p 6379:6379 --name redis redis:6.2

# Or install locally and start services
```

#### Start the Backend
```bash
cd backend
npm run dev
```

#### Start the AI Engine
```bash
cd ai-engine
python -m uvicorn src.main:app --host 0.0.0.0 --port 5000 --reload
```

#### Start the Frontend (in a new terminal)
```bash
cd frontend
npm run dev
```

### 5. Access the Application

Open your browser and navigate to:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **AI Engine API**: http://localhost:5000
- **API Documentation**: http://localhost:8000/api-docs

## First Steps

### 1. Create an Admin User

Since this is your first time running the application, you'll need to create an admin user. You can do this through the API:

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "email": "admin@carboncapture.com",
    "password": "securepassword123",
    "role": "admin"
  }'
```

### 2. Login and Get Token

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@carboncapture.com",
    "password": "securepassword123"
  }'
```

Save the JWT token from the response for subsequent API calls.

### 3. Create Your First Carbon Capture Unit

```bash
curl -X POST http://localhost:8000/api/units \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Demo Carbon Capture Unit",
    "capacity": {
      "co2PerDay": 100,
      "efficiency": 85
    },
    "technology": {
      "type": "direct_air_capture",
      "manufacturer": "Demo Corp",
      "model": "DAC-100"
    },
    "location": {
      "address": "123 Industrial Ave",
      "city": "Demo City",
      "country": "Demo Country",
      "coordinates": {
        "latitude": 40.7128,
        "longitude": -74.0060
      }
    }
  }'
```

### 4. Add Sensors to Your Unit

```bash
# Get your unit ID from the previous response, then:
curl -X POST http://localhost:8000/api/sensors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "unitId": "YOUR_UNIT_ID",
    "sensorId": "TEMP-001",
    "name": "Temperature Sensor 1",
    "type": "temperature",
    "location": {
      "zone": "absorber",
      "position": "inlet"
    }
  }'
```

### 5. Start the IoT Simulation

```bash
cd iot-simulation
python -m src.simulation.simulation_engine
```

This will start simulating sensor data for your carbon capture unit.

## Understanding the Dashboard

### Key Metrics
- **Capture Efficiency**: Percentage of CO2 being captured
- **Energy Consumption**: kWh per ton of CO2 captured
- **System Health**: Overall system status
- **Carbon Credits**: Issued and available credits

### Real-time Monitoring
- **Sensor Readings**: Live data from all sensors
- **Alerts**: System warnings and critical issues
- **AI Insights**: Optimization recommendations

### Management Features
- **Unit Configuration**: Modify unit settings and parameters
- **Sensor Management**: Add, configure, and maintain sensors
- **User Management**: Add operators and manage permissions
- **Reports**: Generate performance and compliance reports

## Working with Carbon Credits

### 1. Generate Carbon Credits

The system automatically generates carbon credits based on verified capture data. You can also manually create credits:

```bash
curl -X POST http://localhost:8000/api/credits \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "unitId": "YOUR_UNIT_ID",
    "amount": 100,
    "vintage": 2024,
    "methodology": "direct_air_capture",
    "co2Captured": 100
  }'
```

### 2. List Credits on Marketplace

```bash
curl -X POST http://localhost:8000/api/credits/CREDIT_ID/list \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "askingPrice": 25.00
  }'
```

### 3. Transfer Credits

```bash
curl -X POST http://localhost:8000/api/credits/CREDIT_ID/transfer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "toUserId": "RECIPIENT_USER_ID",
    "amount": 50,
    "price": 25.00,
    "transactionType": "sale"
  }'
```

## AI-Powered Optimization

### Efficiency Optimization

The AI engine continuously analyzes sensor data to optimize capture efficiency:

```bash
curl -X POST http://localhost:8000/api/ai/optimize/YOUR_UNIT_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Predictive Maintenance

Get maintenance predictions:

```bash
curl -X GET http://localhost:8000/api/ai/health \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## IoT Simulation Scenarios

### Running Different Scenarios

```bash
# Normal operation
python -m src.simulation.simulation_engine --scenario normal_operation

# Maintenance scenario
python -m src.simulation.simulation_engine --scenario maintenance_scenario

# Equipment failure simulation
python -m src.simulation.simulation_engine --scenario failure_scenario

# Peak load testing
python -m src.simulation.simulation_engine --scenario peak_load
```

### Custom Scenarios

Create your own scenarios by editing `iot-simulation/config/simulation_config.json`:

```json
{
  "scenarios": {
    "custom_scenario": {
      "name": "Custom Test Scenario",
      "description": "Your custom simulation scenario",
      "duration_minutes": 30,
      "sensor_anomalies": 0.05,
      "system_events": [
        {
          "time": 10,
          "type": "custom_event",
          "description": "Custom event description"
        }
      ]
    }
  }
}
```

## Monitoring and Troubleshooting

### Health Checks

```bash
# API health
curl http://localhost:8000/health

# AI Engine health
curl http://localhost:5000/health

# Database connection
curl http://localhost:8000/api/health/database
```

### Logs

View application logs:

```bash
# Backend logs
cd backend && npm run logs

# AI Engine logs
cd ai-engine && tail -f logs/ai_engine.log

# IoT Gateway logs
cd iot-simulation && tail -f logs/gateway.log
```

### Common Issues

1. **Database Connection Failed**
   - Ensure MongoDB is running on the correct port
   - Check connection string in `.env` file

2. **AI Engine Not Responding**
   - Check if Python dependencies are installed
   - Verify AI Engine is running on port 5000

3. **Sensor Data Not Appearing**
   - Check MQTT broker connectivity
   - Verify IoT Gateway is running
   - Check sensor configurations

4. **Authentication Issues**
   - Verify JWT token is valid and not expired
   - Check user permissions for the requested operation

## Advanced Configuration

### Environment Variables

```bash
# Performance tuning
MAX_CONCURRENT_REQUESTS=1000
REQUEST_TIMEOUT=30000

# Security settings
BCRYPT_ROUNDS=12
SESSION_TIMEOUT=3600000

# AI Engine settings
AI_MODEL_UPDATE_INTERVAL=3600
AI_CONFIDENCE_THRESHOLD=0.85

# IoT settings
MQTT_KEEP_ALIVE=60
SENSOR_BUFFER_SIZE=1000
```

### Scaling the Application

#### Horizontal Scaling
```bash
# Run multiple backend instances
docker-compose up --scale backend=3

# Load balancer configuration
nginx -c /etc/nginx/nginx.conf
```

#### Database Scaling
```bash
# MongoDB sharding setup
mongosh --eval "sh.enableSharding('carbon-capture')"
mongosh --eval "sh.shardCollection('carbon-capture.units', { '_id': 1 })"
```

## Next Steps

Now that you have the basic system running, you can:

1. **Explore the Dashboard**: Use the web interface to monitor your carbon capture operations
2. **Add More Units**: Scale up by adding more carbon capture units
3. **Customize Scenarios**: Create realistic simulation scenarios for testing
4. **Integrate External Systems**: Connect to real carbon capture equipment
5. **Set Up Monitoring**: Configure comprehensive monitoring and alerting
6. **Deploy to Production**: Follow the deployment guide for production setup

## Getting Help

- **Documentation**: Check the `/docs` directory for detailed guides
- **API Reference**: Visit `/api-docs` for interactive API documentation
- **Community**: Join our community forums for support and discussions
- **Issues**: Report bugs and request features on GitHub

Welcome to the future of carbon capture management! 🎉