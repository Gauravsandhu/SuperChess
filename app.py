from flask import Flask, jsonify, render_template
import chess

app = Flask(__name__)

board = chess.Board()

game_state = {
    "board" : board.fen(),
    "turn" : "white",
    "mode" : "classic",
    "status" : "active",
    "dice_roll" : None,
    "dice_used" : False,
    "hands" : {"white" : [] , "black" : []},
    "deck" : [],
    "effects" : {"white" : {} , "black" : {}},
    "room_id" : None,
    "players" : {"white" : None, "black" : None}

}


# Route to serve the webpage

@app.route('/')
def index():
    return render_template('index.html')


# Route to serve the Game Data

@app.route('/api/state')
def get_state():
    return jsonify(game_state)

if __name__ == '__main__':
    app.run(debug = True)





