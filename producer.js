const uuid = require("uuid");
const amqp = require('amqplib');

// RabbitMQ connection string
const messageQueueConnectionString = "amqp://rabbitmq:5672";

let channel = undefined;
let counter = 0;
const setup = async () => {
  console.log("Setting up RabbitMQ Exchanges/Queues");
  let connection = undefined;
  try{
    // connect to RabbitMQ Instance
    connection = await amqp.connect(messageQueueConnectionString);
  } catch (error) {
    console.log('failed connecting to rabbitmq');
    if (counter < 10){
      setTimeout(setup, 3000);
    }else{
      throw error;
    }
    return;
  }

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