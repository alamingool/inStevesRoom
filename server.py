from flask import Flask, request, jsonify
from flask_cors import CORS

# Import from our renamed and cleaned-up AI logic file
from ai_core import run_steve_ai, load_state, save_state, reset_state

app = Flask(__name__)
CORS(app) 

current_state = reset_state()
if current_state is None:
    raise Exception("Could not load initial state. Make sure template.json exists.")

@app.route('/chat', methods=['POST'])
def chat():
    global current_state
    user_input = request.json.get('message')
    if not user_input:
        return jsonify({"error": "No message provided"}), 400

    response_data, new_state = run_steve_ai(current_state, user_input)
    
    current_state = new_state
    save_state(current_state)

    return jsonify({
        "dialogue": response_data.get("dialogue"),
        "visualState": response_data.get("visualState")
    })

# This line is only needed if you run 'python server.py' directly
if __name__ == '__main__':
    app.run(port=5000)