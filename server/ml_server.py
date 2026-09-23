import os
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from sklearn.neural_network import MLPClassifier
import joblib

app = Flask(__name__)
CORS(app)

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'sign_model.pkl')

# Global model variable
model = None

@app.route('/predict', methods=['POST'])
def predict():
    global model
    if model is None:
        return jsonify({'error': 'Model not trained or initialized'}), 400
        
    data = request.get_json()
    if not data or 'vector' not in data:
        return jsonify({'error': 'Missing vector in request'}), 400
        
    try:
        vector = np.array(data['vector']).reshape(1, -1)
        if vector.shape[1] != 63:
            return jsonify({'error': f'Invalid vector length. Expected 63, got {vector.shape[1]}'}), 400
            
        probabilities = model.predict_proba(vector)[0].tolist()
        top_index = int(np.argmax(probabilities))
        confidence = float(probabilities[top_index])
        
        return jsonify({
            'signId': top_index,
            'confidence': confidence,
            'probabilities': probabilities
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/train', methods=['POST'])
def train():
    global model
    data = request.get_json()
    if not data or 'features' not in data or 'labels' not in data:
        return jsonify({'error': 'Missing features or labels in request'}), 400
        
    try:
        X = np.array(data['features'])
        y_raw = np.array(data['labels'])
        
        if len(X) == 0:
            return jsonify({'error': 'Empty dataset'}), 400
            
        # Convert one-hot encoded labels to class indices
        y = np.argmax(y_raw, axis=1)
        
        # Scikit-learn MLP with same layer sizes
        model = MLPClassifier(
            hidden_layer_sizes=(128, 64, 32),
            activation='relu',
            solver='adam',
            learning_rate_init=0.002,
            max_iter=30,
            random_state=42
        )
        
        model.fit(X, y)
        
        # Save model
        joblib.dump(model, MODEL_PATH)
        
        train_acc = float(model.score(X, y))
        
        return jsonify({
            'success': True,
            'accuracy': train_acc * 100,
            'loss': float(model.loss_)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/reset', methods=['POST'])
def reset():
    global model
    if os.path.exists(MODEL_PATH):
        try:
            os.remove(MODEL_PATH)
        except Exception as e:
            print(f"Error removing model file: {e}")
    model = None
    return jsonify({'success': True})

if __name__ == '__main__':
    if os.path.exists(MODEL_PATH):
        try:
            model = joblib.load(MODEL_PATH)
            print("Loaded saved model from pkl file.")
        except Exception as e:
            print(f"Error loading model: {e}")
            
    app.run(host='0.0.0.0', port=5001, debug=True)
