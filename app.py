from chatbot import get_response
from flask import Flask, render_template, request, url_for, send_from_directory
from flask_socketio import SocketIO, emit
from engineio.payload import Payload
from aruco_ar import ARUCO_DICT, augmentAruco, readb64
import base64
import cv2
import tensorflow_hub as hub
import tensorflow as tf
import os
import numpy as np
import matplotlib.pylab as plt
from datetime import datetime
from woocommerce_rest_api import publish_art_api, get_index_art
import eventlet
eventlet.monkey_patch()

Payload.max_decode_packets = 4096
app = Flask(__name__)
app.secret_key= "workshop2"
# socketio = SocketIO(app,cors_allowed_origins='*')
socketio = SocketIO(app,cors_allowed_origins='*')

app.config['UPLOAD_FOLDER']="upload/"
app.config['IMAGE_FOLDER']="upload/aiModelImage/image/"
app.config['STYLE_FOLDER']="upload/aiModelImage/style/"
app.config['RESULT_FOLDER']="upload/aiModelImage/result/"
app.config['ART_DIRC']="upload/austism_child_art/"

aruco_type = "DICT_6X6_100"
arucoDict = cv2.aruco.Dictionary_get(ARUCO_DICT[aruco_type])
arucoParams = cv2.aruco.DetectorParameters_create()
base_path = "C:/Users/User/Desktop/Workshop 2 Website"

model = hub.load("model")

def load_image(img_path):
    img = tf.io.read_file(img_path)
    img = tf.image.decode_image(img, channels=3)
    img = tf.image.convert_image_dtype(img, tf.float32)
    if img.shape.as_list() > [1280, 720, 3]: 
        img = tf.image.resize(img,[1280, 720], preserve_aspect_ratio=True)
    img = img[tf.newaxis, :]
    return img

## API
@app.route("/get_gallery")
def get_gallery():
    return get_index_art()

@app.route("/get_art")
def get_art():
    os.chdir(base_path)
    os.chdir(app.config['ART_DIRC'])
    files = os.listdir()
    num_of_files = len(files)
    files = filter(os.path.isfile, files)
    files = [f for f in files]
    files.sort(key=lambda x: os.path.getmtime(x))
    files = [dict(id = os.path.splitext(files[i])[0], \
              url = os.path.join(app.config['ART_DIRC'], files[i]),\
              title = os.path.splitext(files[i])[0].replace("_", " ").capitalize()) \
                for i in range(num_of_files if num_of_files < 18 else 18)]
    files = dict(art = files)
    return files 
    
@app.route("/upload/<path:name>")
def get_image(name):
    return send_from_directory(app.config['UPLOAD_FOLDER'], name)

@app.route("/chat-bot-response", methods=['POST'])
def get_chatbot_response():
    question = request.json['data']
    response = get_response(question)
    return {
        'response' : response
    }

@app.route('/augmented_reality')
def augmented_reality():
    global image_file_name_2
    image_file_name_2 = request.args.get('image', "", type=str)
    return render_template('augmented_reality.html')

## Socket
@socketio.on('image')
def image(data_image):
    frame = (readb64(data_image))
    imgAug = cv2.imread(os.path.join(app.config['RESULT_FOLDER'], image_file_name_2) + ".png")
    imgGray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    corners, ids, rejected = cv2.aruco.detectMarkers(imgGray, arucoDict, parameters=arucoParams)
    if len(corners) !=0:
            for bbox, id in zip(corners, ids):
                frame = augmentAruco(bbox, frame, imgAug)
    imgencode = cv2.imencode('.jpeg', frame,[cv2.IMWRITE_JPEG_QUALITY,40])[1]
    stringData = base64.b64encode(imgencode).decode('utf-8')
    b64_src = 'data:image/jpeg;base64,'
    stringData = b64_src + stringData
    emit('response_back', stringData)

## WebPage
@app.route('/')
def index():
    return render_template('index.html')


@app.route("/chat-bot")
def get_chatbot():
    return render_template('chat.html')

@app.route("/art_generator",methods=['GET','POST'])
def art_generator():
    os.chdir("C:/Users/User/Desktop/Workshop 2 Website")
    if request.method=='POST':
        base_image=request.files['base_image']
        base_image_filepath=os.path.join(app.config["IMAGE_FOLDER"],base_image.filename)
        base_image.save(base_image_filepath)

        if request.files['style_image'].filename == '' :
            style_image_filepath =app.config['ART_DIRC'] + request.form['styleId'] + ".jpg"
        else : 
            style_image=request.files['style_image']
            style_image_filepath = os.path.join(app.config["STYLE_FOLDER"],style_image.filename)
            style_image.save(style_image_filepath)

        content_image = load_image(img_path=base_image_filepath)
        style_image = load_image(img_path=style_image_filepath)
        stylized_image = model(tf.constant(content_image), tf.constant(style_image))[0]
        plt.axis('off')
        plt.imshow(np.squeeze(stylized_image))
        datetimeNow = datetime.now().strftime("%m%d%Y%H%M%S")
        result_image_filepath=os.path.join(app.config["RESULT_FOLDER"],datetimeNow)
        plt.savefig(result_image_filepath, bbox_inches='tight', pad_inches = 0)
        return url_for('result', id=datetimeNow)
    else:
        return render_template("art_generator.html")

@app.route("/result/<id>")
def result(id):
    path ="/" + os.path.join(app.config["RESULT_FOLDER"],id) + ".png"
    return render_template("result.html", result_image=path, 
        publish_url=url_for('publish_art', id=id))

@app.route("/publish/<id>", methods=['GET','POST'])
def publish_art(id):
    if request.method=='POST':
        form_data = request.form
        image_tags = form_data["tags"].replace(" ", "").split(",")
        image_tags = [tag.capitalize() for tag in image_tags]
        publish_art_api(title = form_data["title"], name = form_data["name"], 
            description = form_data["description"], tags = image_tags, id = id, 
            date = datetime.now().strftime("%d/%m/%Y"), phone_number = form_data["contact"])
        return {
            "status" : "success",
            "message" : "Submitted Successfully"
        }
    else: 
        path = "/"+  os.path.join(app.config["RESULT_FOLDER"],id)+".png"
        return render_template("publish.html", result_image = path, 
            post_path = url_for('publish_art', id=id), 
            cancel_path = url_for('result', id=id))

@app.route("/aruco", methods=['GET'])
def aruco():
    return render_template("aruco.html") 
    
if __name__ == '__main__':
    socketio.run(app, port=5000, debug=True,  host = "0.0.0.0")
    #certfile ='SSL/localhost.crt', keyfile = 'SSL/localhost.key',