// Fetch the game state from Flask Backend

async function fetchGameState() {
    const response = await fetch('/api/state');
    const state = await response.json();


    // Log it to verify
    console.log("Game State Received: ", state);

    // Send the board portion of the state to be rendered
    renderBoard(state.board);
}

function renderBoard(fen){
    const boardDiv = document.getElementById('board');
    boardDiv.innerHTML = '';

    // Extract just the layout portion of the FEN string and split it into rows
    const ranks = fen.split(' ')[0].split('/');

    ranks.forEach((rank,rowIndex) => {
        for(let char of rank){
            if(isNaN(char)){
                // If the character is a letter, create a square with that piece
                createSquare(boardDiv, char, rowIndex);
            }
            else{
                // If the character is a number, create that many empty squares
                for (let i = 0; i < parseInt(char); i++) {
                    createSquare(boardDiv, null, rowIndex);
                }
            }
        }
        
    });
}




function createSquare(container,piece, rowIndex){
    const square = document.createElement('div');
    square.className = 'square';

    // Calculate whether the square should be light or dark based on its position
    const isBlack = (rowIndex + container.children.length) % 2 !== 0;
    square.classList.add(isBlack ? 'black-sq' : 'white-sq');

    // Insert the raw piece letter for now (e.g., 'r', 'N', 'P')
    if (piece) {
        square.innerText = piece; 
    }

    container.appendChild(square);

}


fetchGameState();