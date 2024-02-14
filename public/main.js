//main.js
const socket = io();

let isAdmin = false;
let questionStartTime; 
let currentGamePin; 

const nicknameInput = document.getElementById("nicknameInput");
const sendButton = document.getElementById("sendButton");
const messageArea = document.getElementById("messageArea");

//FUNCIONES Y SUS PAREJAS//////////////////////////////////////

//NICKNAME/////////////////////////////////////////////////////

sendButton.addEventListener("click", function () {
    const nickname = nicknameInput.value.trim();
    if (nickname) {
        socket.emit("nickname", { nickname: nickname });
        hideInputAndButton();
        displayGreeting(nickname);
        displayGameOptions();
    } else {
        console.log("Please enter a nickname.");
    }
});

function hideInputAndButton() {
    const nicknameArea = document.getElementById("nicknameArea");
    nicknameArea.style.display = 'none';
}

function displayGreeting(nickname) {
    messageArea.innerHTML = `Bienvenido, ${nickname}`;
}

function displayGameOptions() {

    document.getElementById("adminButton").style.display = 'block';

    document.getElementById("joinGameArea").style.display = 'block';
}

//LISTA USUARIOS/////////////////////////////////////////////////////

socket.on("update player list", function (players) {
    displayPlayerList(players);
});

function displayPlayerList(players) {
    const playerListElement = document.getElementById("playerList");
    playerListElement.innerHTML = ''; // Clear existing list

    players.forEach(player => {
        const playerElement = document.createElement("li");
        playerElement.textContent = player.nickname; 
        playerListElement.appendChild(playerElement);
    });
}

//ADMIN BUTTON/////////////////////////////////////////////////////

document.getElementById("adminButton").addEventListener("click", function () {
    isAdmin = true;

    document.getElementById("gameConfigForm").style.display = 'block';
    document.getElementById("adminButton").style.display = 'none';
    document.getElementById("joinGameArea").style.display = 'none';
});

document.getElementById("adminButton").addEventListener("click", function () {
    showAdminInterface();
});

function showAdminInterface() {
}

document.getElementById("submitGameConfig").addEventListener("click", function () {
    const gameName = document.getElementById("gameName").value.trim();
    const questionTime = document.getElementById("questionTime").value;
    const questionQuantity = document.getElementById("questionQuantity").value;
    const questionCategory = document.getElementById("questionCategory").value;

    socket.emit("create game", {
        gameName,
        questionTime,
        questionQuantity,
        questionCategory
    });

    document.getElementById("gameConfigForm").style.display = 'none';
});

//PIN/////////////////////////////////////////////////////

function displayGamePin(pin) {
    const pinDisplayArea = document.createElement("div");
    pinDisplayArea.innerHTML = `<h3>Your Game PIN: ${pin}</h3>`;
    document.body.appendChild(pinDisplayArea);

    document.getElementById("gameConfigForm").style.display = 'none';
}

//JUEGO CREADO/////////////////////////////////////////////////////

socket.on("game created", function (data) {
    if (isAdmin) {
        currentGamePin = data.pin;
        console.log("Game created with PIN:", data.pin);
        displayAdminGameArea(data.pin);
    }
});

function displayAdminGameArea(pin) {
    document.getElementById("gamePIN").textContent = "Game PIN: " + pin;
    document.getElementById("adminControls").style.display = 'block';
    document.getElementById("playerListArea").style.display = 'block';
    document.getElementById("waitingMessage").style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function () {
    const newGameContainer = document.getElementById('newGameContainer');
    const newGameButton = document.getElementById('newGameButton');

   
    socket.on("game over", function (data) {
        console.log(data.message); 
        newGameContainer.style.display = 'block'; 
    });

});

//ENTEAR EN PARTIDA/////////////////////////////////////////////////////

socket.on("joined game", function (data) {
    if (!isAdmin) {
        if (data.success) {
            currentGamePin = data.pin;
            console.log("Successfully joined game with PIN:", data.pin);
            hideAllElementsExcept(['playerListArea', 'playerGameView']); 
            displayPlayerGameArea();
        } else {
            console.log("Failed to join game. Reason:", data.reason);
        }
    }
});

function displayPlayerGameArea() {
    document.getElementById("playerListArea").style.display = 'block';
    document.getElementById("adminControls").style.display = 'none';
}

//PLAY BUTTON/////////////////////////////////////////////////////

document.getElementById("playButton").addEventListener("click", function () {
    const gamePin = document.getElementById("gamePinInput").value.trim();
    if (gamePin) {
        socket.emit("join game", gamePin);
    } else {
        console.log("Please enter a game PIN.");
    }
});

document.addEventListener('DOMContentLoaded', function () {
    console.log("DOM fully loaded and parsed");

    const startGameButton = document.getElementById("startGameButton");
    if (startGameButton) {
        console.log("Start Game Button found");

        startGameButton.addEventListener("click", function () {
            const gamePINText = document.getElementById("gamePIN").textContent;
            const gamePIN = gamePINText.split(": ")[1];
            console.log("Starting game with PIN:", gamePIN); 
            socket.emit("start game", gamePIN);
        });
    } else {
        console.log("Start Game Button not found");
    }
});

//CATEGORIAS/////////////////////////////////////////////////////

socket.on("categories", function (categories) {
    const categorySelect = document.getElementById("questionCategory");
    categorySelect.innerHTML = '';

    categories.forEach(category => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
    });
});

//INICIANDO PARTIDA/////////////////////////////////////////////////////

socket.on("game starting", function (data) {
    const feedbackElement = document.getElementById('feedback');
    feedbackElement.style.display = 'none'; 
    feedbackElement.textContent = '';

    if (isAdmin) {
        displayQuestionForAdmin(data.question);
        startTimer(data.questionTime, true); 
    } else {
        displayAnswersForPlayers(data.question.answers, data.questionIndex, data.questionTime);
        startTimer(data.questionTime, false); 
    }
});

//TIEMPO/////////////////////////////////////////////////////

let currentTimer;

function startTimer(duration, isAdmin) {
    if (currentTimer) {
        clearInterval(currentTimer); 
    }

    let timer = duration;
    const timerDisplayId = isAdmin ? 'adminTimerDisplay' : 'playerTimerDisplay';
    const timerDisplay = document.getElementById(timerDisplayId);

    updateTimerDisplay(timer, timerDisplay);

    currentTimer = setInterval(function () {
        timer -= 1;
        updateTimerDisplay(timer, timerDisplay);

        if (timer < 0) {
            clearInterval(currentTimer);
            console.log("Times up!");
            disableAnswerButtons();

        }
    }, 1000);
}

function updateTimerDisplay(timer, displayElement) {
    let minutes = parseInt(timer / 60, 10);
    let seconds = parseInt(timer % 60, 10);

    minutes = minutes < 10 ? "0" + minutes : minutes;
    seconds = seconds < 10 ? "0" + seconds : seconds;

    displayElement.textContent = `${minutes}:${seconds}`;
}

//PREGUNTAS Y RESPUESTAS PARA EL ADMIN/////////////////////////////////////////////////////

function displayQuestionForAdmin(question) {
    hideAllElementsExcept(['adminGameView']);

    const adminGameView = document.getElementById('adminGameView');
    const questionDisplay = document.getElementById('questionDisplay');
    questionDisplay.innerHTML = '';

    const questionText = document.createElement('h3');
    questionText.textContent = question.question;
    questionDisplay.appendChild(questionText);

    question.answers.forEach((answer, index) => {
        const answerDiv = document.createElement('div');
        answerDiv.textContent = answer;
        questionDisplay.appendChild(answerDiv);
    });

    adminGameView.style.display = 'block';
}

//PREGUNTAS Y RESPUESTAS PARA EL JUGADOR/////////////////////////////////////////////////////

function displayAnswersForPlayers(answers, questionIndex, questionTime) {
    hideAllElements();

    questionStartTime = Date.now(); 

    enableAnswerButtons();

    for (let i = 0; i < answers.length; i++) {
        let answerButton = document.getElementById(`answer${i}`);
        answerButton.textContent = answers[i];
        answerButton.dataset.questionIndex = questionIndex;

        answerButton.onclick = function () {
            if (!hasAnsweredCurrentQuestion) {
                const answerTime = Math.floor((Date.now() - questionStartTime) / 1000); 
                submitAnswer(questionIndex, i, answerTime);
                hasAnsweredCurrentQuestion = true;
                disableAnswerButtons();
            }
        };
    }

    hasAnsweredCurrentQuestion = false;
    const playerGameView = document.getElementById('playerGameView');
    playerGameView.style.display = 'block';
    startTimer(questionTime, false);
}

function submitAnswer(questionId, selectedAnswerIndex, answerTime) {
    console.log("Player selected answer:", selectedAnswerIndex, "Answer Time:", answerTime, "Game PIN:", currentGamePin);
    socket.emit("answer selected", { pin: currentGamePin, questionId, selectedAnswerIndex, answerTime });
}

socket.on("score update", function (scoreData) {
    console.log("Score update received:", scoreData);
    displayScoreTable(scoreData);

    const scoreElement = document.getElementById("playerScore");
    if (scoreElement) {
        scoreElement.textContent = `Your Score: ${scoreData.score}, Correct Answers: ${scoreData.correct}, Incorrect Answers: ${scoreData.incorrect}`;
    }
});
function displayScoreTable(scoreData) {
    const container = document.getElementById("scoreTableContainer");
    container.innerHTML = '';

    const totalAnswers = scoreData.correct + scoreData.incorrect;
    const successPercentage = totalAnswers > 0 ? Math.round((scoreData.correct / totalAnswers) * 100) : 0;

    const table = document.createElement("table");
    table.innerHTML = `
        <tr>
            <th>Points</th>
            <th>Correct Answers</th>
            <th>Incorrect Answers</th>
            <th>Success Percentage</th>
        </tr>
        <tr>
            <td>${scoreData.score}</td>
            <td>${scoreData.correct}</td>
            <td>${scoreData.incorrect}</td>
            <td>${successPercentage}%</td>
        </tr>
    `;
    container.appendChild(table);
}

//ESCONDER, ACTIVAR Y DESACTIVAR BOTONES/////////////////////////////////////////////////////

function hideAllElementsExcept(exceptions) {
    const allElements = ['nicknameArea', 'messageArea', 'adminButton', 'joinGameArea', 'gameConfigForm', 'adminControls', 'playerListArea', 'adminGameView', 'playerGameView'];

    allElements.forEach(elementId => {
        if (!exceptions.includes(elementId)) {
            const element = document.getElementById(elementId);
            if (element) {
                element.style.display = 'none';
            }
        }
    });
}

function hideAllElements() {
    const elementsToHide = ['nicknameArea', 'messageArea', 'adminButton', 'joinGameArea', 'gameConfigForm', 'adminControls', 'playerListArea'];

    elementsToHide.forEach(elementId => {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = 'none';
        }
    });
}

function enableAnswerButtons() {
    const answerButtons = document.querySelectorAll('.answerButton');
    answerButtons.forEach(button => {
        button.disabled = false;
    });
}

function disableAnswerButtons() {
    const answerButtons = document.querySelectorAll('.answerButton');
    answerButtons.forEach(button => {
        button.disabled = true;
    });
}

//FEEDBACK PARA LA RESPUESTA/////////////////////////////////////////////////////

socket.on("answer feedback", function (feedback) {
    console.log("Feedback received:", feedback);

    const feedbackElement = document.getElementById('feedback');
    if (feedback.isCorrect !== undefined) {
        feedbackElement.style.display = 'block';
        if (feedback.isCorrect) {
            feedbackElement.textContent = "Correcto!";
            feedbackElement.style.color = "green";
        } else {
            feedbackElement.textContent = `Incorrecto. La respuesta correcta era el número: ${feedback.correctAnswerIndex}`;
            feedbackElement.style.color = "red";
        }
    } else if (feedback.message) {
        feedbackElement.textContent = feedback.message;
        feedbackElement.style.display = 'block';
    }
});


//EXTRAS/////////////////////////////////////////////////////

socket.on("error", function (message) {
    console.log("Error:", message);
});

socket.on('nickname rebut', function (data) {
    console.log(data);
});

socket.on("get users", function (data) {
    const users = [];

    for (let [id, socket] of io.of("/").sockets) {
        users.push({
            userID: id,
            username: socket.data.nickname,
        });
    }
    socket.emit("users", users);

});
socket.on("game over admin", function(data) {
    document.getElementById("nicknameArea").style.display = 'none';
    document.getElementById("messageArea").style.display = 'none';
    document.getElementById("adminButton").style.display = 'none';
    document.getElementById("joinGameArea").style.display = 'none';
    document.getElementById("gameConfigForm").style.display = 'none';
    document.getElementById("adminControls").style.display = 'none';
    document.getElementById("playerListArea").style.display = 'none';
    document.getElementById("adminGameView").style.display = 'none';
    document.getElementById("resultContainer").style.display = 'none';
    displayPodium(data.rankings);
});

function displayPodium(rankings) {
    console.log("Displaying podium for rankings:", rankings); 

    const podiumContainer = document.getElementById('podiumContainer');
    if (!podiumContainer) {
        console.error("Podium container not found!");
        return; 
    }

    podiumContainer.innerHTML = ''; 
    rankings.forEach((ranking, index) => {
        const podiumEntry = document.createElement('div');
        podiumEntry.textContent = `${index + 1}. ${ranking.nickname}: ${ranking.score} points`;
        podiumContainer.appendChild(podiumEntry);
    });

    podiumContainer.style.display = 'block'; 
    const newAdminGameButton = document.getElementById('newAdminGameButton');
    if (newAdminGameButton) {
        newAdminGameButton.style.display = 'block';
    }
}

document.getElementById('newAdminGameButton').addEventListener('click', function() {
    document.getElementById('podiumContainer').style.display = 'none';
    this.style.display = 'none'; 
    document.getElementById('gameConfigForm').style.display = 'block';
    
});

socket.on("game over player", function(data) {
    if (!isAdmin) { // Check if the current user is not an admin
        document.getElementById("playerGameView").style.display = 'none';
        document.getElementById("feedback").style.display = 'none';
        displayPlayerResult(data); // Display the player's result for players
    }
});


function displayPlayerResult(data) {
    // Assuming you have a result container in your HTML
    const resultContainer = document.getElementById('resultContainer');
    resultContainer.innerHTML = `Tu posición: ${data.position}, Puntos: ${data.score}, Aciertos: ${data.correct}, Fallos: ${data.incorrect}`;

    resultContainer.style.display = 'block'; // Show the player's result
}

socket.on('salutacio', function (data) {
    console.log(data)
})