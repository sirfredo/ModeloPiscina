/**
 * @authors Rafael Mira
 */

import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { ortho, lookAt, flatten, perspective } from "../../libs/MV.js";
import { modelView, loadMatrix, multRotationY, multScale, pushMatrix, popMatrix, multTranslation, multRotationZ, multRotationX } from "../../libs/stack.js";
import { GUI } from "../../libs/dat.gui.module.js";
import * as THREE from "../../libs/three.module.js";
import * as SPHERE from "../../libs/objects/sphere.js";
import * as CYLINDER from "../../libs/objects/cylinder.js";
import * as CUBE from "../../libs/objects/cube.js";
import * as PYRAMID from "../../libs/objects/pyramid.js";
import * as TORUS from "../../libs/objects/torus.js";
import * as BUNNY from "../../libs/objects/bunny.js";
import * as TRIANGLE from "../../libs/objects/triangle.js";

/** @type WebGLRenderingContext */
let gl;

let animationSpeed = 1 / 60.0;
let mode; // Drawing mode (gl.LINES or gl.TRIANGLES)
let animation = true; // Animation is running

/**
 * Viewport distance
 */
const VP_DISTANCE = 60;

/**
 * Viewport distance for the helicopter camera
 */
let newVp_dist = VP_DISTANCE;

let comprimento = parseFloat(document.getElementById("comprimento").value);
let largura = parseFloat(document.getElementById("largura").value);
let maxProfundidade = parseFloat(document.getElementById("maxProfundidade").value);
let minProfundidade = parseFloat(document.getElementById("minProfundidade").value);
let lengthMaxProf = parseFloat(document.getElementById("lengthMaxProf").value);
let lengthMinProf = parseFloat(document.getElementById("lengthMinProf").value);

let rampBase = comprimento - lengthMaxProf - lengthMinProf;
let rampHeight = maxProfundidade - minProfundidade;

// ########################################## Constants ########################################## //

// Colors
const BLACK = [0.1, 0.1, 0.1];
const BLUE = [0.04, 0.65, 0.98];
const GREEN = [0.0, 0.5, 0.2];
const GREY = [0.57, 0.57, 0.57];
const RED = [0.93, 0.14, 0.05];
const YELLOW = [0.97, 0.73, 0.0];
const BROWN = [0.55, 0.27, 0.07];
const WHITE = [1.0, 1.0, 1.0];
const SKY = [0.68, 0.78, 0.8];
const DARK_GREY = [0.25, 0.25, 0.25];

let axonometricCamera = true;

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.x = 15;
camera.position.y = -63.5;

function setup(shaders) {
	let canvas = document.getElementById("gl-canvas");
	let aspect = canvas.width / canvas.height;
	gl = setupWebGL(canvas);

	let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);
	let mProjection = ortho(-newVp_dist * aspect, newVp_dist * aspect, -newVp_dist, newVp_dist, -3 * newVp_dist, 3 * newVp_dist);
	let mView = lookAt([0, 0.6, 1], [0, 0.6, 0], [0, 1, 0]);

	mode = gl.TRIANGLES;

	resize_canvas();
	window.addEventListener("resize", resize_canvas);

	const gui = new GUI();
	const cameraFolder = gui.addFolder("Camera");
	cameraFolder.add(camera.position, "x", -180, 180, 1).name("Vertical");
	cameraFolder.add(camera.position, "y", -180, 180, 1).name("Horizontal");

	document.onkeydown = function (event) {
		switch (event.key) {
			case "w":
				mode = gl.LINES;
				break;
			case "s":
				mode = gl.TRIANGLES;
				break;
			case "p":
				animation = !animation;
				break;
			case "+":
				if (animation) animationSpeed *= 1.1;
				break;
			case "-":
				if (animation) animationSpeed /= 1.1;
				break;
			case "1":
				mView = lookAt([0, 0.6, 1], [0, 0.6, 0], [0, 1, 0]);
				axonometricCamera = true;
				helicopterCamera = false;
				break;
			case "2": // Front view
				mView = lookAt([0, 0.6, 1], [0, 0.6, 0], [0, 1, 0]);
				axonometricCamera = false;
				helicopterCamera = false;
				break;
			case "3": // Top view
				mView = lookAt([0, 1.6, 0], [0, 0.6, 0], [0, 0, -1]);
				axonometricCamera = false;
				helicopterCamera = false;
				break;
			case "4": // Right view
				mView = lookAt([1, 0.6, 0], [0, 0.6, 0], [0, 1, 0]);
				axonometricCamera = false;
				helicopterCamera = false;
				break;
			case "5": // helicopter view
				helicopterCamera = true;
				axonometricCamera = false;
				break;
			case "ArrowUp":
				helicopterUp();
				break;
			case "ArrowDown":
				helicopterDown();
				break;
			case "ArrowLeft":
				helicopterMove();
				break;
			case " ":
				createBox();
				break;
		}
	};

	window.addEventListener("keyup", function (event) {
		switch (event.key) {
			case "ArrowLeft":
				helicopterRotating = false;
				break;
		}
	});

	gl.clearColor(SKY[0], SKY[1], SKY[2], 1.0);
	BUNNY.init(gl);
	SPHERE.init(gl);
	CYLINDER.init(gl);
	CUBE.init(gl);
	TORUS.init(gl);
	PYRAMID.init(gl);
	TRIANGLE.init(gl);
	gl.enable(gl.DEPTH_TEST); // Enables Z-buffer depth test
	window.requestAnimationFrame(render);

	function resize_canvas(event) {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

		aspect = canvas.width / canvas.height;

		gl.viewport(0, 0, canvas.width, canvas.height);
		mProjection = ortho(-newVp_dist * aspect, newVp_dist * aspect, -newVp_dist, newVp_dist, -3 * newVp_dist, 3 * newVp_dist);
	}

	function uploadModelView() {
		gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
	}

	/**
	 * Changes the color to be displayed on screen.
	 * @param {[number,number,number]} color - array with a color
	 */
	function changeColor(color) {
		const uColor = gl.getUniformLocation(program, "uColor");
		gl.useProgram(program);
		gl.uniform3f(uColor, color[0], color[1], color[2]);
	}

	function render() {
		window.requestAnimationFrame(render);

		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.useProgram(program);
		gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));

		loadMatrix(mView);

		if (axonometricCamera) {
			pushMatrix();
			/* */ multRotationX(camera.position.x);
			/* */ multRotationY(camera.position.y);
			/* */ piscina();
			popMatrix();
		} else piscina();
	}

	function piscina() {
		pushMatrix();
		multTranslation(upScale([0, 0, 1.8]));

		pushMatrix();
		/* */ // eixos();
		popMatrix();

		pushMatrix();
		/* */ planos();
		popMatrix();

		pushMatrix();
		/* */ paredeLateral();
		popMatrix();

		pushMatrix();
		/* */ multTranslation(upScale([0, 0, -3 - paredeFrontalDim[2]]));
		/* */ paredeLateral();
		popMatrix();

		pushMatrix();
		/* */ multTranslation(upScale([paredeLateralDim[0] / 2 + paredeFrontalDim[2] / 2, 0, -paredeFrontalDim[0] / 2 - paredeLateralDim[2] / 2]));
		/* */ multRotationY(90);
		/* */ // paredeFrontal();
		popMatrix();

		pushMatrix();
		/* */ multTranslation(upScale([-paredeLateralDim[0] / 2 - paredeFrontalDim[2] / 2, 0, -paredeFrontalDim[0] / 2 - paredeLateralDim[2] / 2]));
		/* */ multRotationY(90);
		/* */ paredeFrontal();
		popMatrix();

		pushMatrix();
		/* */ drawPillars();
		popMatrix();

		pushMatrix();
		/* */ // multTranslation(upScale([0, -paredeLateralDim[1] / 2 + 0.1, -paredeLateralDim[2] / 2]));
		/* */ multTranslation(upScale([-lengthMaxProf, -rampaDim[2], -paredeLateralDim[2] / 2]));
		/* */ multRotationY(-90);
		/* */ multRotationX(-90);
		/* */ rampa();
		popMatrix();

		popMatrix();
	}

	function eixos() {
		pushMatrix();
		/* */ multTranslation([50, 0, 0]);
		/* */ eixoX();
		popMatrix();

		pushMatrix();
		/* */ multTranslation([0, 50, 0]);
		/* */ eixoY();
		popMatrix();

		pushMatrix();
		/* */ multTranslation([0, 0, 50]);
		/* */ eixoZ();
		popMatrix();
	}

	function planos() {
		pushMatrix();
		/* */ multTranslation(upScale([0, -paredeLateralDim[1] / 2, -paredeFrontalDim[0] / 2 - paredeLateralDim[2] / 2]));
		/* */ multRotationX(90);
		/* */ fundo();
		popMatrix();

		pushMatrix();
		/* */ multTranslation(upScale([-paredeLateralDim[0] / 2.675, 0, -paredeFrontalDim[0] / 2 - paredeLateralDim[2] / 2]));
		/* */ multRotationX(90);
		/* */ plano1Metro();
		popMatrix();

		pushMatrix();
		/* */ //multTranslation(upScale([paredeLateralDim[0] / 2 - 1.5, -0.4, -paredeFrontalDim[0] / 2 - paredeLateralDim[2] / 2]));
		/* */ multTranslation(upScale([paredeLateralDim[0] / 2 - plano1_7MetrosDim[0] / 2, -rampaDim[2], -paredeFrontalDim[0] / 2 - paredeLateralDim[2] / 2]));
		/* */ multRotationX(90);
		/* */ planoVertical2Metro();
		popMatrix();
	}

	function drawPillars() {
		pushMatrix();
		/* */ multTranslation(upScale([paredeLateralDim[0] / 2 + pilarDim[0] / 2, 0, 0]));
		/* */ pilar();
		popMatrix();
		pushMatrix();
		/* */ multTranslation(upScale([-paredeLateralDim[0] / 2 - pilarDim[0] / 2, 0, 0]));
		/* */ pilar();
		popMatrix();
		pushMatrix();
		/* */ multTranslation(upScale([-paredeLateralDim[0] / 2 - pilarDim[0] / 2, 0, -paredeFrontalDim[0] - pilarDim[0]]));
		/* */ pilar();
		popMatrix();
		pushMatrix();
		/* */ multTranslation(upScale([paredeLateralDim[0] / 2 + pilarDim[0] / 2, 0, -paredeFrontalDim[0] - pilarDim[0]]));
		/* */ pilar();
		popMatrix();
	}

	const SCALE = 20;
	function upScale(array) {
		return array.map((e) => e * SCALE);
	}

	let expessura = 0.2;

	let paredeLateralDim = [comprimento, maxProfundidade, expessura];

	let paredeFrontalDim = [largura, maxProfundidade, expessura];

	let planoDim = [comprimento, largura, 0.001];

	let plano1MetroDim = [lengthMaxProf, largura, 0.001];

	let plano1_7MetrosDim = [lengthMinProf, largura, 0.001];

	let pilarDim = [expessura, maxProfundidade, expessura];

	let rampaDim = [largura, rampBase, rampHeight];

	function paredeLateral() {
		multScale(upScale(paredeLateralDim));
		changeColor(YELLOW);
		uploadModelView();
		CUBE.draw(gl, program, mode);
	}

	function paredeFrontal() {
		multScale(upScale(paredeFrontalDim));
		changeColor(GREEN);
		uploadModelView();
		CUBE.draw(gl, program, mode);
	}

	function fundo() {
		multScale(upScale(planoDim));
		changeColor(WHITE);
		uploadModelView();
		CUBE.draw(gl, program, mode);
	}

	function plano1Metro() {
		multScale(upScale(plano1MetroDim));
		changeColor(BLUE);
		uploadModelView();
		CUBE.draw(gl, program, mode);
	}

	function planoVertical2Metro() {
		multScale(upScale(plano1_7MetrosDim));
		changeColor(BLUE);
		uploadModelView();
		CUBE.draw(gl, program, mode);
	}

	function pilar() {
		multScale(upScale(pilarDim));
		changeColor(BROWN);
		uploadModelView();
		CUBE.draw(gl, program, mode);
	}

	function rampa() {
		multScale(upScale(rampaDim));
		changeColor(BROWN);
		uploadModelView();
		TRIANGLE.draw(gl, program, mode);
	}

	function eixoX() {
		multScale(upScale([5, 0.01, 0.01]));
		changeColor(BLACK);
		uploadModelView();
		CUBE.draw(gl, program, mode);
	}

	function eixoY() {
		multScale(upScale([0.01, 5, 0.01]));
		changeColor(RED);
		uploadModelView();
		CUBE.draw(gl, program, mode);
	}

	function eixoZ() {
		multScale(upScale([0.01, 0.01, 5]));
		changeColor(GREEN);
		uploadModelView();
		CUBE.draw(gl, program, mode);
	}
}

function calcularInclinacao() {
	let comprimento = parseFloat(document.getElementById("comprimento").value);
	let largura = parseFloat(document.getElementById("largura").value);
	let maxProfundidade = parseFloat(document.getElementById("maxProfundidade").value);
	let minProfundidade = parseFloat(document.getElementById("minProfundidade").value);
	let lengthMaxProf = parseFloat(document.getElementById("lengthMaxProf").value);
	let lengthMinProf = parseFloat(document.getElementById("lengthMinProf").value);

	let rampBase = comprimento - lengthMaxProf - lengthMinProf;
	let rampHeight = maxProfundidade - minProfundidade;

	if (isNaN(comprimento) || isNaN(largura) || isNaN(maxProfundidade) || isNaN(minProfundidade) || isNaN(lengthMaxProf) || isNaN(lengthMinProf)) {
		document.getElementById("resultado").textContent = "Por favor, insira valores válidos.";
		return;
	}

	if (comprimento < 0 || largura < 0 || maxProfundidade < 0 || minProfundidade < 0 || lengthMaxProf < 0 || lengthMinProf < 0) {
		document.getElementById("resultado").textContent = "Insira valores válidos. (Maiores ou iguais a zero)";
		return;
	}

	const inclinacaoRadianos = Math.atan(rampHeight / rampBase);
	const inclinacaoGraus = (inclinacaoRadianos * 180) / Math.PI;

	document.getElementById("resultado").innerText = `
            A rampa fica com ${rampBase} metros de comprimento 
			e com uma inclinação de ${inclinacaoGraus.toFixed(2)} graus.`;

	render();
}

// Attach an event listener to the button and call the function
var calcularButton = document.getElementById("calcularButton");
calcularButton.addEventListener("click", calcularInclinacao);

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then((shaders) => setup(shaders));
