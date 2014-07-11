// For an introduction to the Blank template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkId=232509
(function () {
    "use strict";

    var app = WinJS.Application;
    var activation = Windows.ApplicationModel.Activation;
    WinJS.strictProcessing();

    var canvas, context, stage;
    var bgImage, playerImage, ammoImage, enemyImage;
    var bgBitmap, playerBitmap, ammoBitmap, enemyBitmap;
    var preload;

    var SCALE_X = window.innerWidth / 800;
    var SCALE_Y = window.innerHeight / 480;
    var MARGIN = 25;
    var GROUND_Y = 400 * SCALE_Y;

    var playersLives = 3;
    var pLives;
    var playerScore = 0
    var pScore;

    var isShotFlying = false;
    var playerFire = false;
    var shotVelocity;

    var MAX_SHOT_POWER = 10;
    var GRAVITY = 0.07;

    var isAiming = false;
    var aimStart, aimVector;

    app.onactivated = function (args) {
        if (args.detail.kind === activation.ActivationKind.launch) {
            if (args.detail.previousExecutionState !== activation.ApplicationExecutionState.terminated) {
                // TODO: This application has been newly launched. Initialize
                // your application here.
                showMenu();
                $("#nameSubmit").click(function (e) {
                    if ($('#nameText').val() != "") {
                        $('#nameText').hide();
                        $('#nameSubmit').hide();
                        addHighscore(playerScore, $('#nameText').val());
                        showMenu();
                    }
                });
            } else {
                // TODO: This application has been reactivated from suspension.
                // Restore application state here.
            }
            args.setPromise(WinJS.UI.processAll());
        }
    };

    function showMenu() {
        $("#pause").hide();
        $('#menu').show();
        $('#menu').html('<div id="start" class="menuOption">Start game</div><div id="highScores" class="menuOption">Show highscores</div>');
        $('#start').click(function () { initialize(); });
        $('#highScores').click(function () { getHighscores(); });
        $("#info").hide();
        $('#addHighscore').hide();
    }

    function addHighscore(pts, name) {
        $.ajax({
            type: "GET",
            url: "http://catapultgame.cba.pl/setHighscores.php?name=" + name + "&points=" + pts,          
        });
    }

    function getHighscores() {

        WinJS.xhr({ url: "http://catapultgame.cba.pl/getHighscores.php" }).done(
          function (data) {
              var score = $(toStaticHTML(data.response));
              $('#menu').html('<div id="scoresBack" class="win-backbutton"></div><hr>Top 5<hr /><div id="showScores">' + toStaticHTML(score[3].innerHTML) + '</div>');
              $('#scoresBack').click(function () { showMenu(); });
          });
    }

    function initialize() {
        playersLives = 3;
        playerScore = 0;
        Ticker.setPaused(false);
        $("body").css("background-color", "white");
        var pause = false;
        $("#menu").hide();
        $("#pause").show();
        $('#pause').click(function () {
            if (!pause) {
                Ticker.setPaused(true);
                $('#pause').text("Resume");
                $("#info").text("GAME PAUSED").show();
                pause = true;
            } else {
                Ticker.setPaused(false);
                $('#pause').text("Pause");
                $("#info").hide();
                pause = false;
            }
        });
        canvas = document.getElementById("gameCanvas");
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        context = canvas.getContext("2d");

        canvas.addEventListener("MSPointerUp", endAim, false);
        canvas.addEventListener("MSPointerMove", adjustAim, false);
        canvas.addEventListener("MSPointerDown", beginAim, false);

        stage = new Stage(canvas);

        preload = new createjs.PreloadJS();
        preload.onComplete = prepareGame;
        var manifest = [
            { id: "screenImage", src: "images/Backgrounds/gameplay_screen.png" },
            { id: "ammoImage", src: "images/Ammo/rock_ammo.png" },
            { id: "enemyImage", src: "images/Enemy/enemy.png" },
            { id: "playerImage", src: "images/Catapults/player.png" },
        ];
        preload.loadManifest(manifest);
    }

    function prepareGame() {
        //Draw background image
        bgImage = preload.getResult("screenImage").result;
        bgBitmap = new Bitmap(bgImage);
        bgBitmap.scaleX = SCALE_X;
        bgBitmap.scaleY = SCALE_Y;
        stage.addChild(bgBitmap);

        //Draw player catapult
        playerImage = preload.getResult("playerImage").result;
        playerBitmap = new Bitmap(playerImage);
        playerBitmap.scaleX = SCALE_X;
        playerBitmap.scaleY = SCALE_Y;
        playerBitmap.x = MARGIN;
        playerBitmap.y = GROUND_Y - playerImage.height * SCALE_Y;
        stage.addChild(playerBitmap);

        //Draw ammo
        ammoImage = preload.getResult("ammoImage").result;
        ammoBitmap = new Bitmap(ammoImage);
        ammoBitmap.scaleX = SCALE_X;
        ammoBitmap.scaleY = SCALE_Y;
        ammoBitmap.visible = false; 
        stage.addChild(ammoBitmap);

        //Draw enemy
        enemyImage = preload.getResult("enemyImage").result;
        enemyBitmap = new Bitmap(enemyImage);
        enemyBitmap.scaleX = SCALE_X;
        enemyBitmap.scaleY = SCALE_Y;
        enemyBitmap.x = canvas.width - MARGIN - (enemyImage.width * SCALE_X);
        enemyBitmap.y = Math.random() * 500 + 100;
        stage.addChild(enemyBitmap);

        //Player lives
        pLives = new Text("Health: " + playersLives, "20px sans-serif", "red");
        pLives.scaleX = SCALE_X;
        pLives.scaleY = SCALE_Y;
        pLives.x = MARGIN;
        pLives.y = MARGIN * SCALE_Y - 20;
        stage.addChild(pLives);

        //Player score
        pScore = new Text("Score: " + playerScore, "20px sans-serif", "red");
        pScore.scaleX = SCALE_X;
        pScore.scaleY = SCALE_Y;
        pScore.x = canvas.width / 2;
        pScore.y = MARGIN * SCALE_Y - 20;
        stage.addChild(pScore);

        stage.update();

        startGame();
    }

    function startGame() {
        Ticker.setInterval(window.requestAnimationFrame);
        Ticker.addListener(gameLoop);
    }

    function gameLoop() {
        update();
        draw();
    }

    function update() {
        if (isShotFlying) {
            ammoBitmap.x += shotVelocity.x;
            ammoBitmap.y += shotVelocity.y;
           // Debug.writeln("x: " + ammoBitmap.x + " y: " + ammoBitmap.y);
            shotVelocity.y += GRAVITY;
           // Debug.writeln("Shot velocity x: " + shotVelocity.x + " y:" + shotVelocity.y);

            if (ammoBitmap.y + ammoBitmap.image.height >= GROUND_Y || ammoBitmap.x <= 0 || ammoBitmap.x + ammoBitmap.image.width >= canvas.width) {
                // Miss
                isShotFlying = false; 
                ammoBitmap.visible = false; 
            }
            else {
                // Hit!
                if (checkHit(enemyBitmap)) {
                    pScore.text = "Score: " + ++playerScore;
                    spawn(enemyBitmap);
                }
            }
        }
        else {
            if (playerFire) {
                playerFire = false;
                ammoBitmap.x = playerBitmap.x + (playerBitmap.image.width * SCALE_X / 2);
                ammoBitmap.y = playerBitmap.y;
                shotVelocity = aimVector;
               // Debug.writeln("x: " + aimVector.x + " y: " + aimVector.y);
                fireShot();
            }
        }
        if (enemyBitmap.x < 0) {
            pLives.text = "Health: " + --playersLives;
            spawn(enemyBitmap);
            processHit();
        }
        else
            enemyBitmap.x--;    
    }

    function beginAim(event) {
        if (!isAiming) {
            aimStart = new Point(event.x, event.y);
            //Debug.writeln("x: " + aimStart.x + " y: " + aimStart.y);
            isAiming = true;
        }
    }

    function calculateAim(start, end) {
        var aim = new Point((end.x - start.x) / 70, (end.y - start.y) / 70);
        aim.x = Math.min(MAX_SHOT_POWER, aim.x); 
        aim.x = Math.max(0, aim.x);     
        aim.y = Math.max(-MAX_SHOT_POWER, aim.y);  
        aim.y = Math.min(0, aim.y);   
        return aim;
    }

    function endAim(event) {
        if (isAiming) {
            isAiming = false;
            var aimCurrent = new Point(event.x, event.y);
            aimVector = calculateAim(aimStart, aimCurrent);
            playerFire = true;
        }
    }

    function fireShot() {
        ammoBitmap.visible = true;
        isShotFlying = true;
    }

    function checkHit(target) {
        var shotX = ammoBitmap.x + ammoBitmap.image.width / 2;
        var shotY = ammoBitmap.y + ammoBitmap.image.height / 2;

        return (((shotX >= target.x) && (shotX <= target.x + (target.image.width * SCALE_X))) && ((shotY >= target.y) && (shotY <= target.y + (target.image.height * SCALE_Y))));
    }

    function spawn(target) {
        target.x = canvas.width - MARGIN - (enemyImage.width * SCALE_X);
        target.y = Math.random() * 500 + 100;
    }

    function processHit() {

        isShotFlying = false;
        ammoBitmap.visible = false;

        if (playersLives <= 0) {
            endGame();
        }
    }

    function endGame() {
        Ticker.setPaused(true); 
        $('#scorePoints').text("Points: " + playerScore);
        $('#nameText').val("").show();
        $('#nameSubmit').show();
    }

    function draw() {
        stage.update(); //EaselJS
    }

    app.oncheckpoint = function (args) {
        // TODO: This application is about to be suspended. Save any state
        // that needs to persist across suspensions here. You might use the
        // WinJS.Application.sessionState object, which is automatically
        // saved and restored across suspension. If you need to complete an
        // asynchronous operation before your application is suspended, call
        // args.setPromise().
    };

    document.addEventListener("DOMContentLoaded", showMenu, false);
    app.start();
})();
