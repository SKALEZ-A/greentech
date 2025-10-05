#!/usr/bin/env python3
"""
MQTT Protocol Handler for Carbon Capture IoT Network

This module provides MQTT communication capabilities for IoT devices
and sensors in the carbon capture network.
"""

import sys
import os
import json
import logging
import time
import threading
from typing import Dict, List, Any, Optional, Callable
import paho.mqtt.client as mqtt
from queue import Queue
import ssl

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MQTTProtocol:
    """
    MQTT protocol handler for IoT communication.
    """

    def __init__(self,
                 broker: str = 'localhost',
                 port: int = 1883,
                 client_id: str = None,
                 username: str = None,
                 password: str = None,
                 use_tls: bool = False,
                 ca_certs: str = None,
                 certfile: str = None,
                 keyfile: str = None):
        """
        Initialize MQTT client.

        Args:
            broker: MQTT broker hostname
            port: MQTT broker port
            client_id: Unique client identifier
            username: MQTT username
            password: MQTT password
            use_tls: Whether to use TLS/SSL
            ca_certs: CA certificates file
            certfile: Client certificate file
            keyfile: Client private key file
        """
        self.broker = broker
        self.port = port
        self.client_id = client_id or f"carbon_capture_{int(time.time())}"
        self.username = username
        self.password = password
        self.use_tls = use_tls
        self.ca_certs = ca_certs
        self.certfile = certfile
        self.keyfile = keyfile

        # MQTT client
        self.client = None
        self.is_connected = False

        # Message queues
        self.message_queue = Queue()
        self.command_queue = Queue()

        # Subscriptions
        self.subscriptions = {}

        # Callbacks
        self.on_message_callbacks = []
        self.on_connect_callbacks = []
        self.on_disconnect_callbacks = []

        # Initialize client
        self._initialize_client()

    def _initialize_client(self):
        """Initialize MQTT client with callbacks."""
        self.client = mqtt.Client(client_id=self.client_id, clean_session=True)

        # Set credentials if provided
        if self.username and self.password:
            self.client.username_pw_set(self.username, self.password)

        # Configure TLS if requested
        if self.use_tls:
            if self.ca_certs:
                self.client.tls_set(ca_certs=self.ca_certs,
                                  certfile=self.certfile,
                                  keyfile=self.keyfile)
            else:
                self.client.tls_set()

        # Set callbacks
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message
        self.client.on_publish = self._on_publish
        self.client.on_subscribe = self._on_subscribe

        logger.info(f"Initialized MQTT client {self.client_id}")

    def _on_connect(self, client, userdata, flags, rc):
        """Handle connection established."""
        if rc == 0:
            self.is_connected = True
            logger.info(f"MQTT client {self.client_id} connected to {self.broker}:{self.port}")

            # Resubscribe to all topics
            for topic in self.subscriptions.keys():
                self.client.subscribe(topic, qos=self.subscriptions[topic])

            # Call connection callbacks
            for callback in self.on_connect_callbacks:
                try:
                    callback()
                except Exception as e:
                    logger.error(f"Error in connect callback: {e}")
        else:
            error_messages = {
                1: "Connection refused - incorrect protocol version",
                2: "Connection refused - invalid client identifier",
                3: "Connection refused - server unavailable",
                4: "Connection refused - bad username or password",
                5: "Connection refused - not authorised"
            }
            error_msg = error_messages.get(rc, f"Unknown error code: {rc}")
            logger.error(f"MQTT connection failed: {error_msg}")

    def _on_disconnect(self, client, userdata, rc):
        """Handle disconnection."""
        self.is_connected = False
        logger.warning(f"MQTT client {self.client_id} disconnected (code: {rc})")

        # Call disconnect callbacks
        for callback in self.on_disconnect_callbacks:
            try:
                callback(rc)
            except Exception as e:
                logger.error(f"Error in disconnect callback: {e}")

        # Attempt reconnection if not intentionally disconnected
        if rc != 0:
            logger.info("Attempting to reconnect...")
            self.reconnect()

    def _on_message(self, client, userdata, message):
        """Handle incoming message."""
        try:
            topic = message.topic
            payload = message.payload.decode('utf-8')

            # Try to parse JSON payload
            try:
                data = json.loads(payload)
            except json.JSONDecodeError:
                data = payload

            message_data = {
                'topic': topic,
                'payload': data,
                'qos': message.qos,
                'retain': message.retain,
                'timestamp': time.time()
            }

            # Add to message queue
            self.message_queue.put(message_data)

            logger.debug(f"Received message on topic {topic}")

            # Call message callbacks
            for callback in self.on_message_callbacks:
                try:
                    callback(message_data)
                except Exception as e:
                    logger.error(f"Error in message callback: {e}")

        except Exception as e:
            logger.error(f"Error processing MQTT message: {e}")

    def _on_publish(self, client, userdata, mid):
        """Handle message published."""
        logger.debug(f"Message {mid} published successfully")

    def _on_subscribe(self, client, userdata, mid, granted_qos):
        """Handle subscription confirmed."""
        logger.debug(f"Subscription {mid} confirmed with QoS {granted_qos}")

    def connect(self) -> bool:
        """
        Connect to MQTT broker.

        Returns:
            Success status
        """
        try:
            logger.info(f"Connecting to MQTT broker {self.broker}:{self.port}")
            self.client.connect(self.broker, self.port, keepalive=60)
            self.client.loop_start()
            return True
        except Exception as e:
            logger.error(f"Failed to connect to MQTT broker: {e}")
            return False

    def disconnect(self):
        """Disconnect from MQTT broker."""
        if self.client and self.is_connected:
            self.client.loop_stop()
            self.client.disconnect()
            logger.info(f"MQTT client {self.client_id} disconnected")

    def reconnect(self):
        """Attempt to reconnect to MQTT broker."""
        if not self.is_connected:
            try:
                self.client.reconnect()
            except Exception as e:
                logger.error(f"Reconnection failed: {e}")

    def publish(self, topic: str, payload: Any, qos: int = 0, retain: bool = False) -> bool:
        """
        Publish message to topic.

        Args:
            topic: MQTT topic
            payload: Message payload
            qos: Quality of Service level
            retain: Whether to retain the message

        Returns:
            Success status
        """
        if not self.is_connected:
            logger.warning("Cannot publish - not connected to MQTT broker")
            return False

        try:
            # Convert payload to JSON if it's a dict
            if isinstance(payload, dict):
                payload = json.dumps(payload)

            result = self.client.publish(topic, payload, qos=qos, retain=retain)

            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                logger.debug(f"Published message to topic {topic}")
                return True
            else:
                logger.error(f"Failed to publish message to topic {topic}: {result.rc}")
                return False

        except Exception as e:
            logger.error(f"Error publishing to topic {topic}: {e}")
            return False

    def subscribe(self, topic: str, qos: int = 0, callback: Callable = None) -> bool:
        """
        Subscribe to topic.

        Args:
            topic: MQTT topic pattern
            qos: Quality of Service level
            callback: Optional callback for messages on this topic

        Returns:
            Success status
        """
        try:
            result = self.client.subscribe(topic, qos=qos)

            if result[0] == mqtt.MQTT_ERR_SUCCESS:
                self.subscriptions[topic] = qos
                logger.info(f"Subscribed to topic {topic}")

                # Add callback if provided
                if callback:
                    self.add_message_callback(callback)

                return True
            else:
                logger.error(f"Failed to subscribe to topic {topic}: {result[0]}")
                return False

        except Exception as e:
            logger.error(f"Error subscribing to topic {topic}: {e}")
            return False

    def unsubscribe(self, topic: str) -> bool:
        """
        Unsubscribe from topic.

        Args:
            topic: MQTT topic

        Returns:
            Success status
        """
        try:
            result = self.client.unsubscribe(topic)

            if result[0] == mqtt.MQTT_ERR_SUCCESS:
                if topic in self.subscriptions:
                    del self.subscriptions[topic]
                logger.info(f"Unsubscribed from topic {topic}")
                return True
            else:
                logger.error(f"Failed to unsubscribe from topic {topic}: {result[0]}")
                return False

        except Exception as e:
            logger.error(f"Error unsubscribing from topic {topic}: {e}")
            return False

    def add_message_callback(self, callback: Callable):
        """
        Add callback for incoming messages.

        Args:
            callback: Function to call when message received
        """
        self.on_message_callbacks.append(callback)

    def add_connect_callback(self, callback: Callable):
        """
        Add callback for connection events.

        Args:
            callback: Function to call when connected
        """
        self.on_connect_callbacks.append(callback)

    def add_disconnect_callback(self, callback: Callable):
        """
        Add callback for disconnection events.

        Args:
            callback: Function to call when disconnected
        """
        self.on_disconnect_callbacks.append(callback)

    def get_next_message(self, timeout: float = None) -> Optional[Dict[str, Any]]:
        """
        Get next message from queue.

        Args:
            timeout: Timeout in seconds

        Returns:
            Message data or None if timeout
        """
        try:
            return self.message_queue.get(timeout=timeout)
        except:
            return None

    def get_message_count(self) -> int:
        """
        Get number of messages in queue.

        Returns:
            Number of queued messages
        """
        return self.message_queue.qsize()

    def clear_message_queue(self):
        """Clear all messages from queue."""
        while not self.message_queue.empty():
            self.message_queue.get()

    def get_status(self) -> Dict[str, Any]:
        """
        Get MQTT client status.

        Returns:
            Status information
        """
        return {
            'client_id': self.client_id,
            'broker': self.broker,
            'port': self.port,
            'connected': self.is_connected,
            'subscriptions': list(self.subscriptions.keys()),
            'queued_messages': self.message_queue.qsize(),
            'tls_enabled': self.use_tls
        }

class MQTTManager:
    """
    Manager class for multiple MQTT connections and topics.
    """

    def __init__(self):
        self.clients = {}
        self.topic_handlers = {}

    def add_client(self, name: str, client: MQTTProtocol):
        """
        Add MQTT client to manager.

        Args:
            name: Client name
            client: MQTT client instance
        """
        self.clients[name] = client

        # Add message handler
        client.add_message_callback(lambda msg: self._handle_message(name, msg))

    def _handle_message(self, client_name: str, message: Dict[str, Any]):
        """Handle incoming messages from any client."""
        topic = message['topic']

        # Find matching topic handlers
        for pattern, handler in self.topic_handlers.items():
            if self._topic_matches(topic, pattern):
                try:
                    handler(client_name, message)
                except Exception as e:
                    logger.error(f"Error in topic handler for {pattern}: {e}")

    def _topic_matches(self, topic: str, pattern: str) -> bool:
        """Check if topic matches pattern (simple wildcard matching)."""
        # Convert MQTT wildcards to regex
        import re
        pattern = pattern.replace('+', '[^/]+').replace('#', '.*')
        return bool(re.match(f"^{pattern}$", topic))

    def add_topic_handler(self, pattern: str, handler: Callable):
        """
        Add handler for specific topic pattern.

        Args:
            pattern: Topic pattern (can include + and # wildcards)
            handler: Function to handle messages on matching topics
        """
        self.topic_handlers[pattern] = handler

    def publish_to_all(self, topic: str, payload: Any, qos: int = 0):
        """
        Publish message to all connected clients.

        Args:
            topic: MQTT topic
            payload: Message payload
            qos: Quality of Service level
        """
        for name, client in self.clients.items():
            if client.is_connected:
                client.publish(topic, payload, qos)

    def get_status(self) -> Dict[str, Any]:
        """
        Get status of all MQTT clients.

        Returns:
            Status information for all clients
        """
        return {
            client_name: client.get_status()
            for client_name, client in self.clients.items()
        }

# Utility functions
def create_sensor_topic(unit_id: str, sensor_type: str, sensor_id: str) -> str:
    """
    Create standardized sensor topic.

    Args:
        unit_id: Unit identifier
        sensor_type: Sensor type
        sensor_id: Sensor identifier

    Returns:
        MQTT topic string
    """
    return f"sensors/{unit_id}/{sensor_type}/{sensor_id}"

def create_command_topic(unit_id: str, component: str = None) -> str:
    """
    Create standardized command topic.

    Args:
        unit_id: Unit identifier
        component: Specific component

    Returns:
        MQTT topic string
    """
    if component:
        return f"commands/{unit_id}/{component}"
    return f"commands/{unit_id}"

def create_status_topic(unit_id: str) -> str:
    """
    Create standardized status topic.

    Args:
        unit_id: Unit identifier

    Returns:
        MQTT topic string
    """
    return f"status/{unit_id}"

# Example usage and testing
if __name__ == '__main__':
    # Create MQTT client
    client = MQTTProtocol(
        broker='localhost',
        port=1883,
        client_id='test_client'
    )

    # Connect
    if client.connect():
        # Subscribe to sensor topics
        client.subscribe('sensors/#')

        # Publish test message
        client.publish('sensors/test', {'temperature': 25.5, 'timestamp': time.time()})

        # Wait for messages
        try:
            time.sleep(5)
            message = client.get_next_message(timeout=1)
            if message:
                print(f"Received: {message}")
        except KeyboardInterrupt:
            pass
        finally:
            client.disconnect()