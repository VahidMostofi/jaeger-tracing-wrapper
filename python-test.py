from json import loads
import pika

connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
channel = connection.channel()

channel.queue_declare(queue='monitoring.requests',durable=True)

def callback(ch, method, properties, body):
  print(" [x] Received %r" % body)

channel.basic_consume(queue='monitoring.requests',
                      auto_ack=True,
                      on_message_callback=callback)

print(' [*] Waiting for messages. To exit press CTRL+C')
channel.start_consuming()