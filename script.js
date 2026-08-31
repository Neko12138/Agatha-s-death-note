const CAR_COUNT = 12;
const MIN_CAR_COLUMNS = 18;
const MIN_ENGINE_COLUMNS = 16;
const CAR_COLUMN_WIDTH = 31;
const CAR_HEIGHT = 220;
const CAR_GAP = 46;
const ENGINE_WIDTH = 680;
const TRAIN_Y = 370;
const TRACK_Y = TRAIN_Y + CAR_HEIGHT + 42;
const CONTENT_FONT_SIZE = 96;
const WHEEL_SIDES = 16;
const WHEEL_RADIUS = 30;
const CAR_WHEEL_Y = TRACK_Y - WHEEL_RADIUS;
const ENGINE_WHEEL_Y = TRACK_Y - WHEEL_RADIUS;
const TRACK_SCROLL_SPEED = 0.9;
const SPEED_MARK_SPEED = 13;
const WHEEL_ROTATION_SPEED = 0.08;
const FOCUS_RIGHT_PADDING = 64;
const FOCUS_TRACK_SCREEN_RATIO = 0.76;
const FINAL_TRACK_BOTTOM_PADDING = 18;
const FINAL_TEXT_SCREEN_RATIO = 0.4;
const TRACK_SEGMENT_MULTIPLIER = 1.5;
const TRACK_MIN_SEGMENT_WIDTH = 6000;
const TRACK_UNIT_WIDTH = 96;
const TYPEWRITER_DELAY = 45;
const QUESTION_BOX_LINES = 3;
const BLOOD_RED = "#ff1744";
const BLOOD_RED_DIM = "#e3002d";
const BLOOD_RED_DARK = "#b80024";
const BLOOD_RED_INT = 0xff1744;
const BLOOD_RED_DIM_INT = 0xe3002d;
const DEATH_CAUSES = [
    "gunshot wounds",
    "strangulation",
    "poisoning",
    "stab wounds",
    "drowning",
    "a fall from height",
    "asphyxiation",
    "fatal burns",
    "a car crash",
    "electrocution",
    "blunt force trauma",
    "severe blood loss"
];
const FINAL_ME_TEXT = [
    "It was you! You are the bloodstained author.",
    "You decided how they would die and made their deaths seem reasonable.",
    "You should be held responsible for their deaths."
].join("\n");
const FINAL_YOU_TEXT = [
    "It was me! We are the bloodstained audience.",
    "We do not care who died, or why they died.",
    "We just want to see rivers of blood!"
].join("\n");
const FINAL_AGATHA_TEXT = [
    "It was Agatha Christie",
    "a legendary crime novelist",
    "and perhaps a legendary murderer."
].join("\n");
const AGATHA_UNLOCK_ANSWERS = [
    "ALICE",
    "ASCHER",
    "ANDOVER",
    "BETTY",
    "BARNARD",
    "BEXHILL",
    "CARMICHAEL",
    "CLARKE",
    "CHURSTON",
    "ALEXANDER",
    "BONAPARTE",
    "CUST"
];
const QUESTIONS = [
    { text: "What is the first victim's name?", start: "A" },
    { text: "What is the first victim's surname?", start: "A" },
    { text: "Where did the first victim die?", start: "A" },
    { text: "What is the second victim's name?", start: "B" },
    { text: "What is the second victim's surname?", start: "B" },
    { text: "Where did the second victim die?", start: "B" },
    { text: "What is the third victim's name?", start: "C" },
    { text: "What is the third victim's surname?", start: "C" },
    { text: "Where did the third victim die?", start: "C" },
    { text: "Who killed them?", start: "A" },
    { text: "The killer is ABC.", start: "B" },
    { text: "Who caused the tragedy?", start: "C" },
    { text: "But who truly caused the tragedy?", start: null, allowedAnswers: ["ME", "YOU"] }
];
const CASE_TIMES = [getCaseTime(-1, -1), getCaseTime(0, 0), getCaseTime(1, 1)];

function getCaseTime(dayOffset, hourDirection) {
    const now = new Date();
    const shiftedDate = new Date(now);
    shiftedDate.setDate(now.getDate() + dayOffset);

    const hourOffset = hourDirection === 0 ? 0 : Phaser.Math.Between(3, 10) * hourDirection;
    const hour = (now.getHours() + hourOffset + 24) % 24;

    return `${formatDate(shiftedDate)} ${String(hour).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function formatDate(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

class TrainScene extends Phaser.Scene {
    constructor() {
        super("TrainScene");
        this.focusIndex = 0;
        this.cars = [];
        this.focusTargets = [];
        this.wheels = [];
        this.speedMarks = [];
        this.engine = null;
        this.trackStart = -2200;
        this.trackSegmentWidth = 0;
        this.pendingLayoutFrame = null;
        this.pendingLayoutAnchor = null;
        this.pendingLayoutRightEdge = null;
        this.worldBoundsStart = -900;
        this.worldBoundsEnd = 900;
        this.typewriterTimer = null;
        this.typewriterTarget = null;
        this.finalView = false;
        this.currentQuestionText = "";
        this.finalText = null;
        this.caseDeathCauses = [];
    }

    create() {
        this.cameras.main.setBackgroundColor("#111318");
        this.trackLayer = this.add.container(0, 0);
        this.trainLayer = this.add.container(0, 0);
        this.questionText = this.add.text(24, 18, "", {
            fontFamily: "Consolas, Courier New, monospace",
            fontSize: "18px",
            color: BLOOD_RED,
            lineSpacing: 1
        }).setScrollFactor(0).setDepth(10);
        this.finalText = this.add.text(this.scale.width / 2, this.scale.height * FINAL_TEXT_SCREEN_RATIO, "", {
            fontFamily: "Consolas, Courier New, monospace",
            fontSize: "19px",
            color: BLOOD_RED,
            align: "center",
            lineSpacing: 7,
            wordWrap: { width: Math.min(this.scale.width * 0.82, 1200) }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(11).setVisible(false);

        this.createTrain();
        this.layoutTrain();
        this.createUiCamera();
        this.createKeyboardInput();

        this.scale.on("resize", this.resize, this);
        this.resize(this.scale.gameSize);
    }

    createUiCamera() {
        this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
        this.uiCamera.setScroll(0, 0);
        this.uiCamera.setZoom(1);
        this.cameras.main.ignore(this.questionText);
        this.cameras.main.ignore(this.finalText);
        this.uiCamera.ignore([this.trackLayer, this.trainLayer]);
    }

    update(time) {
        const segmentWidth = this.trackSegmentWidth || TRACK_UNIT_WIDTH;
        this.trackLayer.x = -((time * TRACK_SCROLL_SPEED) % segmentWidth);

        for (const wheel of this.wheels) {
            wheel.rotation += WHEEL_ROTATION_SPEED;
        }

        for (const mark of this.speedMarks) {
            mark.x -= SPEED_MARK_SPEED;
            if (mark.x < -240) {
                mark.x += this.getWorldWidth() + 900;
            }
        }
    }

    createKeyboardInput() {
        this.input.keyboard.on("keydown", (event) => {
            const target = this.getCurrentAnswerTarget();

            if (!target || target.locked) {
                return;
            }

            if (event.key === "Enter") {
                event.preventDefault();
                if (target.content.length === 0) {
                    return;
                }

                if (target.allowedAnswers && !target.allowedAnswers.includes(target.content)) {
                    return;
                }

                this.flushPendingLayout();
                this.finishQuestionTypewriter(target);
                target.locked = true;
                if (this.focusIndex < this.focusTargets.length - 1) {
                    this.focusIndex += 1;
                    this.prepareFinalAnswerInput();
                    this.focusOnCurrentTarget(false);
                } else {
                    this.showFinalText(target.content);
                    this.showFinalView(false);
                }
                return;
            }

            if (event.key === "Backspace") {
                event.preventDefault();
                const rightEdge = target.x + target.width;
                target.content = target.content.slice(0, -1);
                this.updateAnswerTarget(target);
                this.requestLayout(this.focusIndex, rightEdge);
                return;
            }

            if (event.key.length === 1) {
                event.preventDefault();
                const character = event.key.toUpperCase();

                if (!this.canTypeCharacter(target, character)) {
                    return;
                }

                const rightEdge = target.x + target.width;
                target.content += character;
                this.updateAnswerTarget(target);
                this.requestLayout(this.focusIndex, rightEdge);
            }
        });
    }

    canTypeCharacter(target, character) {
        if (target.allowedAnswers) {
            return target.allowedAnswers.some((answer) => answer.startsWith(target.content + character));
        }

        if (target.content.length > 0 || target.requiredStart === null) {
            return true;
        }

        return character.toUpperCase() === target.requiredStart;
    }

    prepareFinalAnswerInput() {
        if (this.focusIndex !== this.cars.length) {
            return;
        }

        this.engine.allowedAnswers = this.hasAgathaEnding() ? ["AGATHA"] : ["ME", "YOU"];
    }

    hasAgathaEnding() {
        return AGATHA_UNLOCK_ANSWERS.every((expected, index) => this.normalizeAnswer(this.cars[index].content) === expected);
    }

    normalizeAnswer(answer) {
        return answer.trim().replace(/\s+/g, " ").toUpperCase();
    }

    requestLayout(anchorIndex, anchorRightEdge) {
        this.pendingLayoutAnchor = anchorIndex;
        this.pendingLayoutRightEdge = anchorRightEdge;

        if (this.pendingLayoutFrame !== null) {
            return;
        }

        this.pendingLayoutFrame = requestAnimationFrame(() => {
            this.pendingLayoutFrame = null;
            this.layoutTrain(this.pendingLayoutAnchor, this.pendingLayoutRightEdge);
            this.pendingLayoutAnchor = null;
            this.pendingLayoutRightEdge = null;
        });
    }

    flushPendingLayout() {
        if (this.pendingLayoutFrame === null) {
            return;
        }

        cancelAnimationFrame(this.pendingLayoutFrame);
        this.pendingLayoutFrame = null;
        this.layoutTrain(this.pendingLayoutAnchor, this.pendingLayoutRightEdge);
        this.pendingLayoutAnchor = null;
        this.pendingLayoutRightEdge = null;
    }

    createTrain() {
        for (let i = 0; i < CAR_COUNT; i += 1) {
            this.cars.push(this.createCar(QUESTIONS[i]));
        }

        this.engine = this.createEngine(QUESTIONS[CAR_COUNT]);

        for (let i = 0; i < 28; i += 1) {
            const mark = this.add.text(i * 330, TRAIN_Y - 86, "- -", {
                fontFamily: "Consolas, Courier New, monospace",
                fontSize: "38px",
                color: BLOOD_RED_DARK
            });
            this.speedMarks.push(mark);
            this.trainLayer.add(mark);
        }
    }

    createCar(question) {
        const style = this.getCarTextStyle();
        const car = {
            content: "",
            locked: false,
            requiredStart: question.start,
            questionFullText: question.text,
            questionRevealed: false,
            questionCursor: 0,
            x: 0,
            width: 0,
            top: this.add.text(0, TRAIN_Y, "", style),
            middle: this.add.text(0, TRAIN_Y + 58, "", style),
            lower: this.add.text(0, TRAIN_Y + 116, "", style),
            bottom: this.add.text(0, TRAIN_Y + 174, "", style),
            contentText: this.add.text(0, TRAIN_Y + 110, "", {
                fontFamily: "Consolas, Courier New, monospace",
                fontSize: `${CONTENT_FONT_SIZE}px`,
                color: BLOOD_RED
            }).setOrigin(0.5),
            coupler: this.add.text(0, TRAIN_Y + 78, "==", {
                fontFamily: "Consolas, Courier New, monospace",
                fontSize: "48px",
                color: BLOOD_RED
            }),
            leftWheel: this.createWheel(),
            rightWheel: this.createWheel()
        };

        this.updateCar(car);
        this.trainLayer.add([
            car.top,
            car.middle,
            car.lower,
            car.bottom,
            car.contentText,
            car.coupler,
            car.leftWheel,
            car.rightWheel
        ]);

        return car;
    }

    updateCar(car) {
        const contentColumns = Math.ceil(car.content.length * 2.15);
        const columns = Math.max(MIN_CAR_COLUMNS, contentColumns);
        const emptySpace = " ".repeat(columns);
        const horizontalLine = "═".repeat(columns);

        car.top.setText("╔" + horizontalLine + "╗");
        car.middle.setText("║" + emptySpace + "║");
        car.lower.setText("║" + emptySpace + "║");
        car.bottom.setText("╚" + horizontalLine + "╝");
        car.contentText.setText(car.content);
        car.width = (columns + 2) * CAR_COLUMN_WIDTH;
    }

    updateAnswerTarget(target) {
        if (target === this.engine) {
            this.updateEngine(target);
            return;
        }

        this.updateCar(target);
    }

    createEngine(question) {
        const style = this.getCarTextStyle();
        const engine = {
            content: "",
            locked: false,
            requiredStart: question.start,
            allowedAnswers: question.allowedAnswers || null,
            questionFullText: question.text,
            questionRevealed: false,
            questionCursor: 0,
            x: 0,
            width: ENGINE_WIDTH,
            stack: this.add.text(0, TRAIN_Y - 70, "  ▄\n  █", {
                fontFamily: "Consolas, Courier New, monospace",
                fontSize: "42px",
                color: BLOOD_RED
            }),
            top: this.add.text(0, TRAIN_Y + 26, "╔" + "═".repeat(16) + "╗  /", style),
            middle: this.add.text(0, TRAIN_Y + 84, "║" + " ".repeat(16) + "║ / ", style),
            lower: this.add.text(0, TRAIN_Y + 142, "║" + " ".repeat(16) + "║/  ", style),
            bottom: this.add.text(0, TRAIN_Y + 200, "╚" + "═".repeat(16) + "╝==>", style),
            contentText: this.add.text(0, TRAIN_Y + 124, "", {
                fontFamily: "Consolas, Courier New, monospace",
                fontSize: `${CONTENT_FONT_SIZE}px`,
                color: BLOOD_RED
            }).setOrigin(0.5),
            frontWheel: this.createWheel(),
            middleWheel: this.createWheel(),
            rearWheel: this.createWheel()
        };

        this.trainLayer.add([
            engine.stack,
            engine.top,
            engine.middle,
            engine.lower,
            engine.bottom,
            engine.contentText,
            engine.frontWheel,
            engine.middleWheel,
            engine.rearWheel
        ]);

        this.updateEngine(engine);
        return engine;
    }

    updateEngine(engine) {
        const contentColumns = Math.ceil(engine.content.length * 2.15);
        const columns = Math.max(MIN_ENGINE_COLUMNS, contentColumns);

        engine.top.setText("╔" + "═".repeat(columns) + "╗  /");
        engine.middle.setText("║" + " ".repeat(columns) + "║ / ");
        engine.lower.setText("║" + " ".repeat(columns) + "║/  ");
        engine.bottom.setText("╚" + "═".repeat(columns) + "╝==>");
        engine.width = Math.max(ENGINE_WIDTH, (columns + 5) * CAR_COLUMN_WIDTH);
        engine.contentText.setText(engine.content);
    }

    layoutTrain(anchorIndex = 0, anchorRightEdge = null) {
        this.focusTargets = [];
        let engineX = 0;

        if (anchorIndex >= this.cars.length) {
            engineX = anchorRightEdge === null ? this.getDefaultEngineX() : anchorRightEdge - this.engine.width;
            this.layoutEngine(engineX);

            for (let i = this.cars.length - 1; i >= 0; i -= 1) {
                const rightEdge = i === this.cars.length - 1 ? engineX : this.cars[i + 1].x;
                const car = this.cars[i];
                this.positionCar(car, rightEdge - CAR_GAP - car.width);
            }
        } else {
            const anchorCar = this.cars[anchorIndex];
            const anchorX = anchorRightEdge === null ? 0 : anchorRightEdge - anchorCar.width;
            this.positionCar(anchorCar, anchorX);

            for (let i = anchorIndex - 1; i >= 0; i -= 1) {
                const rightNeighbor = this.cars[i + 1];
                const car = this.cars[i];
                this.positionCar(car, rightNeighbor.x - CAR_GAP - car.width);
            }

            for (let i = anchorIndex + 1; i < this.cars.length; i += 1) {
                const leftNeighbor = this.cars[i - 1];
                const car = this.cars[i];
                this.positionCar(car, leftNeighbor.x + leftNeighbor.width + CAR_GAP);
            }

            engineX = this.cars[this.cars.length - 1].x + this.cars[this.cars.length - 1].width + CAR_GAP;
            this.layoutEngine(engineX);
        }

        for (const car of this.cars) {
            this.focusTargets.push({
                x: car.x + car.width / 2,
                rightEdge: car.x + car.width + FOCUS_RIGHT_PADDING,
                y: TRAIN_Y + CAR_HEIGHT / 2,
                width: car.width
            });
        }

        this.focusTargets.push({
            x: engineX + this.engine.width / 2,
            rightEdge: engineX + this.engine.width + FOCUS_RIGHT_PADDING,
            y: TRAIN_Y + CAR_HEIGHT / 2,
            width: this.engine.width
        });

        this.updateGroundAndRails();
        this.updateCameraBounds();
    }

    positionCar(car, x) {
        car.x = x;
        car.top.setX(x);
        car.middle.setX(x);
        car.lower.setX(x);
        car.bottom.setX(x);
        car.contentText.setPosition(x + car.width / 2, TRAIN_Y + 111);
        car.coupler.setX(x + car.width + 2);
        car.leftWheel.setPosition(x + 128, CAR_WHEEL_Y);
        car.rightWheel.setPosition(x + car.width - 128, CAR_WHEEL_Y);
    }

    layoutEngine(x) {
        this.engine.x = x;
        this.engine.stack.setX(x + 116);
        this.engine.top.setX(x);
        this.engine.middle.setX(x);
        this.engine.lower.setX(x);
        this.engine.bottom.setX(x);
        this.engine.contentText.setPosition(x + this.engine.width / 2, TRAIN_Y + 124);
        this.engine.frontWheel.setPosition(x + 126, ENGINE_WHEEL_Y);
        this.engine.middleWheel.setPosition(x + 334, ENGINE_WHEEL_Y);
        this.engine.rearWheel.setPosition(x + this.engine.width - 140, ENGINE_WHEEL_Y);
    }

    updateCameraBounds() {
        this.worldBoundsStart = Math.min(this.worldBoundsStart, this.getTrainStart() - 3200);
        this.worldBoundsEnd = Math.max(this.worldBoundsEnd, this.getTrainEnd() + 3200);
        this.cameras.main.setBounds(this.worldBoundsStart, -20000, this.worldBoundsEnd - this.worldBoundsStart, 40000);
    }

    updateGroundAndRails() {
        const trainWidth = this.getTrainWidth();
        const nextSegmentWidth = Math.ceil(
            Math.max(trainWidth * TRACK_SEGMENT_MULTIPLIER, TRACK_MIN_SEGMENT_WIDTH) / TRACK_UNIT_WIDTH
        ) * TRACK_UNIT_WIDTH;
        const segmentWidth = Math.max(this.trackSegmentWidth, nextSegmentWidth);
        const nextTrackStart = this.getTrainStart() - segmentWidth;
        const trackStart = this.trackSegmentWidth === 0 ? nextTrackStart : Math.min(this.trackStart, nextTrackStart);
        const startChanged = Math.abs(trackStart - this.trackStart) >= TRACK_UNIT_WIDTH;
        const widthChanged = segmentWidth !== this.trackSegmentWidth;

        if (!startChanged && !widthChanged) {
            return;
        }

        this.trackStart = trackStart;
        this.trackSegmentWidth = segmentWidth;
        this.redrawGroundAndRails();
    }

    redrawGroundAndRails() {
        this.trackLayer.removeAll(true);

        for (let i = 0; i < 3; i += 1) {
            this.createTrackSegment(this.trackStart + this.trackSegmentWidth * i, this.trackSegmentWidth);
        }
    }

    createTrackSegment(segmentX, segmentWidth) {
        const graphics = this.add.graphics();

        graphics.fillStyle(BLOOD_RED_DARK, 1);
        graphics.fillRect(segmentX, TRACK_Y + 64, segmentWidth, 22);

        graphics.lineStyle(7, BLOOD_RED_INT, 1);
        graphics.lineBetween(segmentX, TRACK_Y, segmentX + segmentWidth, TRACK_Y);
        graphics.lineBetween(segmentX, TRACK_Y + 40, segmentX + segmentWidth, TRACK_Y + 40);

        for (let x = segmentX; x < segmentX + segmentWidth; x += TRACK_UNIT_WIDTH) {
            graphics.lineStyle(4, BLOOD_RED_DIM_INT, 1);
            graphics.lineBetween(x, TRACK_Y - 16, x + 54, TRACK_Y + 58);
        }

        this.trackLayer.add(graphics);
    }

    createWheel() {
        const wheel = this.add.container(0, 0);
        const rim = this.add.graphics();
        const radius = WHEEL_RADIUS;

        rim.lineStyle(5, BLOOD_RED_INT, 1);
        for (let i = 0; i < WHEEL_SIDES; i += 1) {
            const startAngle = (Math.PI * 2 * i) / WHEEL_SIDES;
            const endAngle = (Math.PI * 2 * (i + 1)) / WHEEL_SIDES;
            rim.lineBetween(
                Math.cos(startAngle) * radius,
                Math.sin(startAngle) * radius,
                Math.cos(endAngle) * radius,
                Math.sin(endAngle) * radius
            );
        }

        rim.lineStyle(3, BLOOD_RED_DIM_INT, 1);
        for (let i = 0; i < 8; i += 1) {
            const angle = (Math.PI * 2 * i) / 8;
            rim.lineBetween(0, 0, Math.cos(angle) * radius, Math.sin(angle) * radius);
        }

        rim.fillStyle(BLOOD_RED_INT, 1);
        rim.fillCircle(0, 0, 5);
        wheel.add(rim);
        this.wheels.push(wheel);

        return wheel;
    }

    focusOnCurrentTarget(instant) {
        if (this.finalView) {
            this.showFinalView(instant);
            return;
        }

        const target = this.focusTargets[this.focusIndex];
        const camera = this.cameras.main;
        const zoom = this.getFocusZoom(target.width);
        const viewportWorldWidth = this.scale.width / zoom;
        const viewportWorldHeight = this.scale.height / zoom;
        const cameraX = target.rightEdge - viewportWorldWidth / 2;
        const trackScreenY = this.scale.height * FOCUS_TRACK_SCREEN_RATIO;
        const cameraY = TRACK_Y - trackScreenY / zoom + viewportWorldHeight / 2;

        camera.zoomTo(zoom, instant ? 0 : 700, "Sine.easeInOut");
        camera.pan(cameraX, cameraY, instant ? 0 : 900, "Sine.easeInOut");
        this.startQuestionTypewriter(this.getCurrentAnswerTarget());
    }

    showFinalView(instant) {
        this.finalView = true;
        this.updateCameraBounds();

        const camera = this.cameras.main;
        const zoom = this.getFinalZoom();
        const viewportWorldWidth = this.scale.width / zoom;
        const viewportWorldHeight = this.scale.height / zoom;
        const cameraX = this.getTrainStart() + this.getTrainWidth() / 2;
        const trackScreenY = this.scale.height - FINAL_TRACK_BOTTOM_PADDING;
        const cameraY = TRACK_Y - trackScreenY / zoom + viewportWorldHeight / 2;

        if (instant) {
            camera.setZoom(zoom);
            camera.centerOn(cameraX, cameraY);
            return;
        }

        this.tweens.add({
            targets: camera,
            zoom,
            scrollX: cameraX - viewportWorldWidth / 2,
            scrollY: cameraY - viewportWorldHeight / 2,
            duration: 1100,
            ease: "Sine.easeInOut",
            onComplete: () => {
                camera.setZoom(zoom);
                camera.centerOn(cameraX, cameraY);
            }
        });
    }

    startQuestionTypewriter(target) {
        if (!target || target.questionRevealed || this.typewriterTarget === target) {
            return;
        }

        if (this.typewriterTimer !== null) {
            this.typewriterTimer.remove(false);
            this.typewriterTimer = null;
        }

        this.typewriterTarget = target;
        target.questionCursor = 0;
        this.setQuestionBoxText("");

        this.typewriterTimer = this.time.addEvent({
            delay: TYPEWRITER_DELAY,
            repeat: target.questionFullText.length - 1,
            callback: () => {
                target.questionCursor += 1;
                this.setQuestionBoxText(target.questionFullText.slice(0, target.questionCursor));

                if (target.questionCursor >= target.questionFullText.length) {
                    target.questionRevealed = true;
                    this.typewriterTarget = null;
                    this.typewriterTimer = null;
                }
            }
        });
    }

    finishQuestionTypewriter(target) {
        if (!target || target.questionRevealed) {
            return;
        }

        if (this.typewriterTarget === target && this.typewriterTimer !== null) {
            this.typewriterTimer.remove(false);
            this.typewriterTimer = null;
            this.typewriterTarget = null;
        }

        this.setQuestionBoxText(target.questionFullText);
        target.questionCursor = target.questionFullText.length;
        target.questionRevealed = true;
    }

    resize(gameSize) {
        this.cameras.resize(gameSize.width, gameSize.height);
        this.uiCamera.setSize(gameSize.width, gameSize.height);
        this.uiCamera.setScroll(0, 0);
        this.uiCamera.setZoom(1);
        this.setQuestionBoxText(this.currentQuestionText);
        this.finalText.setPosition(gameSize.width / 2, gameSize.height * FINAL_TEXT_SCREEN_RATIO);
        this.finalText.setWordWrapWidth(Math.min(gameSize.width * 0.82, 1200));
        this.focusOnCurrentTarget(true);
    }

    setQuestionBoxText(text) {
        this.currentQuestionText = text;
        const columns = this.getQuestionBoxColumns();
        const lineCount = this.finalView ? 8 : QUESTION_BOX_LINES;
        const lines = this.wrapQuestionText(text, columns).slice(0, lineCount);
        while (lines.length < lineCount) {
            lines.push("");
        }

        const border = "-".repeat(columns + 2);
        const body = lines.map((line) => `|${line.padEnd(columns, " ")}|`);
        const enterHint = "<ENTER>";
        body[body.length - 1] = `|${enterHint.padStart(columns).slice(-columns)}|`;
        this.questionText.setPosition(28, 28);
        this.questionText.setText([border, ...body, border].join("\n"));
    }

    showFinalText(answer) {
        this.questionText.setVisible(false);
        this.finalText.setVisible(true);
        this.finalText.setText(this.buildFinalText(answer));
        this.finalText.setPosition(this.scale.width / 2, this.scale.height * FINAL_TEXT_SCREEN_RATIO);
        this.finalText.setWordWrapWidth(Math.min(this.scale.width * 0.82, 1200));
    }

    buildFinalText(answer) {
        this.caseDeathCauses = this.pickUniqueDeathCauses(3);
        const firstCase = this.getCaseLine("first", 0);
        const secondCase = this.getCaseLine("second", 3);
        const thirdCase = this.getCaseLine("third", 6);
        const killerName = [this.cars[9].content, this.cars[10].content, this.cars[11].content]
            .filter(Boolean)
            .join(" ");
        const killerLine = `Who was the killer?\n\nThe killer was ${killerName}.`;
        const causeQuestion = "Who truly caused everything?";
        const causeAnswer = this.getFinalCauseAnswer(answer);

        return [
            firstCase,
            secondCase,
            thirdCase,
            killerLine,
            `${causeQuestion}\n\n${causeAnswer}`
        ].join("\n\n");
    }

    getFinalCauseAnswer(answer) {
        if (answer === "AGATHA") {
            return FINAL_AGATHA_TEXT;
        }

        return answer === "ME" ? FINAL_ME_TEXT : FINAL_YOU_TEXT;
    }

    getCaseLine(order, startIndex) {
        const firstName = this.cars[startIndex].content;
        const surname = this.cars[startIndex + 1].content;
        const location = this.cars[startIndex + 2].content;
        const fullName = `${firstName} ${surname}`.trim();
        const cause = this.caseDeathCauses[startIndex / 3] || "";
        return [
            `What was the ${order} case?`,
            "",
            `${fullName} was found dead at ${location}`,
            `time of death should be ${CASE_TIMES[startIndex / 3]}`,
            `cause of death is ${cause}`
        ].join("\n");
    }

    pickUniqueDeathCauses(count) {
        const pool = [...new Set(DEATH_CAUSES.map((cause) => cause.trim()).filter(Boolean))];
        const selected = [];

        while (selected.length < count && pool.length > 0) {
            const index = Phaser.Math.Between(0, pool.length - 1);
            selected.push(pool.splice(index, 1)[0]);
        }

        return selected;
    }

    getQuestionBoxColumns() {
        return Phaser.Math.Clamp(Math.floor((this.scale.width - 96) / 12), 34, 56);
    }

    wrapQuestionText(text, columns) {
        if (text.length === 0) {
            return [""];
        }

        const words = text.split(" ");
        const lines = [];
        let line = "";

        for (const word of words) {
            if (word.length > columns) {
                if (line.length > 0) {
                    lines.push(line);
                    line = "";
                }

                for (let i = 0; i < word.length; i += columns) {
                    lines.push(word.slice(i, i + columns));
                }
                continue;
            }

            if (line.length === 0) {
                line = word;
            } else if (line.length + word.length + 1 <= columns) {
                line += ` ${word}`;
            } else {
                lines.push(line);
                line = word;
            }
        }

        lines.push(line);
        return lines;
    }

    getFocusZoom(targetWidth) {
        const widthZoom = (this.scale.width * 0.66) / targetWidth;
        const heightZoom = this.scale.height / 480;
        return Phaser.Math.Clamp(Math.min(widthZoom, heightZoom), 0.28, 1.75);
    }

    getFinalZoom() {
        const widthZoom = (this.scale.width * 0.94) / Math.max(this.getTrainWidth(), 1);
        const heightZoom = this.scale.height / 340;
        return Phaser.Math.Clamp(Math.min(widthZoom, heightZoom), 0.08, 0.95);
    }

    getWorldWidth() {
        const carsWidth = this.cars.reduce((total, car) => total + car.width + CAR_GAP, 0);
        return carsWidth + this.engine.width;
    }

    getDefaultEngineX() {
        const carsWidth = this.cars.reduce((total, car) => total + car.width + CAR_GAP, 0);
        return carsWidth;
    }

    getTrainStart() {
        return Math.min(...this.cars.map((car) => car.x));
    }

    getTrainEnd() {
        return this.engine.x + this.engine.width;
    }

    getCurrentAnswerTarget() {
        return this.focusIndex < this.cars.length ? this.cars[this.focusIndex] : this.engine;
    }

    getTrainWidth() {
        return this.getTrainEnd() - this.getTrainStart();
    }

    getCarTextStyle() {
        return {
            fontFamily: "Consolas, Courier New, monospace",
            fontSize: "56px",
            color: BLOOD_RED
        };
    }
}

const config = {
    type: Phaser.AUTO,
    parent: document.body,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: "#111318",
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: TrainScene
};

new Phaser.Game(config);
