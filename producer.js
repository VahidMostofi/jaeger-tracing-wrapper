const uuid = require("uuid");
const amqp = require('amqplib');

// RabbitMQ connection string
const messageQueueConnectionString = "amqp://rabbitmq:5672";

let channel = undefined;

const setup = async () => {
  console.log("Setting up RabbitMQ Exchanges/Queues");
  // connect to RabbitMQ Instance
  let connection = await amqp.connect(messageQueueConnectionString);

  // create a channel
  channel = await connection.createConfirmChannel();

  // create exchange
  await channel.assertExchange("monitoring", "direct", { durable: true });

  // create queues
  await channel.assertQueue("monitoring.requests", { durable: true });

  // bind queues
  await channel.bindQueue("monitoring.requests","monitoring", "event");

  console.log("Setup DONE");
};

const sendRecord = ({ httpMethod, path, httpCode, responseTime }) => {

  const event = {
    id: uuid.v4(),
    timestamp: Date.now(),
    httpMethod,
    path,
    httpCode,
    responseTime
  };
  channel.publish("monitoring", "event", Buffer.from(JSON.stringify(event), 'utf-8'), { persistent: true });
};

module.exports = {setup, sendRecord};