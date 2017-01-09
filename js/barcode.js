'use strict';



/**
 * Simple module system loosely based on Asynchronous Module Definition (AMD)
 * add a module calling define('newModuleId', () => { return newModuleContent });
 * add a module that depends of other modules calling define('newModuleId', ['dependencyModuleId1', 'dependencyModuleId2'], (dependendyModuleReference1, dependendyModuleReference2) => { return newModuleContent });
 * use already defined modules calling define(['moduleId1', 'moduleId2'], function(moduleContent1, moduleContent2) { use modules here });
 */
const define = (() => {


	const modulesIndex = [];


	const createModule = (moduleName, moduleDefinition) => {
		const moduleResult = moduleDefinition();
		modulesIndex.push([moduleName, moduleResult]);
		return moduleResult;
	};


	const createModuleWithDependencies = (moduleName, dependencies, moduleDefinition) => {
		const moduleDefinitionWithDependencies = () => {
			return define(dependencies, moduleDefinition);
		};
		return createModule(moduleName, moduleDefinitionWithDependencies);
	};


	const useModules = (modulesList, callback) => {

		const modules = [];

		let moduleName = null;
		let listModuleName = null;
		let listModuleFunction = null;

		//assemble modules based on list
		for (let moduleName of modulesList) {

			for (let moduleObject of modulesIndex) {

				listModuleName = moduleObject[0];
				listModuleFunction = moduleObject[1];

				if (moduleName === listModuleName) {
					modules.push(listModuleFunction);
					break;
				}

			}

		}

		return callback.apply(window, modules);

	};


	const defineOverload = (arg1, arg2, arg3) => {
		if (typeof arg1 === 'string') {
			if (Array.isArray(arg2)) {
				return createModuleWithDependencies(arg1, arg2, arg3);
			} else {
				return createModule(arg1, arg2);
			}
		} else {
			return useModules(arg1, arg2);
		}
	};


	return defineOverload;


})();



define('toBinaryString', () => {

	/**
	 * @param {Number} number
	 * @param {Number} byteSize
	 */
	const toBinaryString = (number, byteSize) => {

		let binaryString = '0b';
		let paddedBinary = '00000000';

		paddedBinary += number.toString(2);
		paddedBinary = paddedBinary.substr(paddedBinary.length - byteSize, byteSize);
		binaryString += paddedBinary;

		return binaryString;

	};

	return toBinaryString;

});



define('writeBytes', () => {

	/**
	 * @param {Array} byteArray Byte array to write bytes into
	 * @param {Number} bytes Bytes to write to the array (bits actually)
	 * @param {Number} length Length of bits to write
	 * @param {Number} offset Index of the byte array where to start writing the bytes
	 */
	const writeBytes = (byteArray, bytes, length, offset) => {

		const byteSize = 8;
		const arraySizeInBytes = byteArray.buffer.byteLength;
		const elementSizeInBytes = byteArray.BYTES_PER_ELEMENT;
		const elementSizeInBits = elementSizeInBytes * byteSize;

		let byteIndex = Math.floor(offset / elementSizeInBits);
		let bitIndex = ((offset + elementSizeInBits) % elementSizeInBits);
		let loop = false;

		// bits are right aligned, so the offset must be enough to align the left sides
		let bitOffset = elementSizeInBits - length - bitIndex;

		// bitwise operators are limited to 32 bits in javascript

		let alignedBytes = 0;
		if (bitOffset > 0) {
			alignedBytes = bytes << bitOffset;
		} else {
			alignedBytes = bytes >>> (-1 * bitOffset);
			loop = true;
		}

		// TODO se já tiver alguma coisa nele, não vai sobrescrever, teria que zerar antes com &= 0b00...
		byteArray[byteIndex] |= alignedBytes;

		if (loop == false && ((length + bitOffset) > elementSizeInBits)) {
			loop = true;
		}

		while (loop) {

			byteIndex++;
			bitOffset += elementSizeInBits;

			if (bitOffset > 0) {
				alignedBytes = bytes << bitOffset;
			} else {
				alignedBytes = bytes >>> (-1 * bitOffset);
			}

			byteArray[byteIndex] |= alignedBytes;

			// if there are no more bytes to write
			if ((byteIndex * elementSizeInBits) > (length + offset)) {
				loop = false;
				continue;
			}

			// if we've reached the end of the byte buffer
			if (byteIndex >= arraySizeInBytes) {
				loop = false;
			}

		}

	}

	return writeBytes;

});



define('readBytes', () => {

	// read part - in progress
	const readBytes = (byteArray, bytes, length, offset) => {

		const byteSize = 8;
		const arraySizeInBytes = byteArray.buffer.byteLength;
		const arraySizeInBits = arraySizeInBytes * byteSize;
		const elementSizeInBytes = byteArray.BYTES_PER_ELEMENT;
		const elementSizeInBits = elementSizeInBytes * byteSize;

		let byteIndex = Math.floor(offset / elementSizeInBits);
		let bitIndex = ((offset + elementSizeInBits) % elementSizeInBits);

		let bit = false;
		let bitMask = 0;

		let binaryString = ''; // só pra debug?

		// TODO
		let streamIndex;
		for (byteIndex = 0, streamIndex = 0; byteIndex < arraySizeInBytes; byteIndex++) {

			bitMask = 1 << (elementSizeInBits - 1); // 0b10000000 for 8 bits

			for (bitIndex = 0; bitIndex < elementSizeInBits && streamIndex < arraySizeInBits; bitIndex++) {

				bit = byteArray[byteIndex] & bitMask;

				binaryString += bit ? '1' : '0';

				bitMask >>= 1;
				streamIndex++;

			}

			binaryString += ' ';

		}

		// TODO mais rápido que o acima?

		let binaryString2 = ''; // só pra debug?

		for (let offset = 0; offset < arraySizeInBits; offset++) {

			byteIndex = Math.floor(offset / elementSizeInBits);
			bitIndex = ((offset + elementSizeInBits) % elementSizeInBits);

			bitMask = 1 << (elementSizeInBits - 1 - bitIndex);

			bit = byteArray[byteIndex] & bitMask;

			binaryString2 += bit ? '1' : '0';
			binaryString2 += (bitIndex == (elementSizeInBits - 1)) ? ' ' : '';

		}

		console.log(binaryString);
		console.log(binaryString2);

	}

	return readBytes;

});



define('IsbnBarCode', ['writeBytes'], (writeBytes) => {

	/**
	 * EAN-13 digit code parity
	 * 0 = L (odd)
	 * 1 = G (even)
	 */
	const digitsGroup1Parity = [
		0b000000, // 0
		0b001011, // 1
		0b001101, // 2
		0b001110, // 3
		0b010011, // 4
		0b011001, // 5
		0b011100, // 6
		0b010101, // 7
		0b010110, // 8
		0b011010  // 9
	];

	/**
	 * EAN-13 digit codes
	 * 0 = L (odd)
	 * 1 = G (even)
	 * 2 = R (reverse)
	 *
	 * G is R in reverse
	 * R is bitwise ~ of L
	 */
	const digitCodes = [
		// group 1           | group 2
		// L        G          R
		[0b0001101, 0b0100111, 0b1110010], // 0
		[0b0011001, 0b0110011, 0b1100110], // 1
		[0b0010011, 0b0011011, 0b1101100], // 2
		[0b0111101, 0b0100001, 0b1000010], // 3
		[0b0100011, 0b0011101, 0b1011100], // 4
		[0b0110001, 0b0111001, 0b1001110], // 5
		[0b0101111, 0b0000101, 0b1010000], // 6
		[0b0111011, 0b0010001, 0b1000100], // 7
		[0b0110111, 0b0001001, 0b1001000], // 8
		[0b0001011, 0b0010111, 0b1110100]  // 9
	];

	/**
	 * EAN-13 standard used in isbn codes and supermarket products
	 */
	const IsbnBarCode = class {

		constructor() {

			Object.defineProperties(this, {
				length: {value: 95},
				_digit1: {value: -1, writable: true},
				_group1: {value: []},
				_group2: {value: []},
				_groupParity: {value: -1, writable: true}
			});

			Object.seal(this);

		}

		push(digitString) {

			let digit = Number.parseInt(digitString, 10);

			if (this._digit1 === -1) {
				this._digit1 = digit;
				this._groupParity = digitsGroup1Parity[this._digit1];
			} else if (this._group1.length < 6) {
				this._group1.push(digit);
			} else if (this._group2.length < 6) {
				this._group2.push(digit);
			}

		}

		getNumbers() {
			let numberSequence = '';
			numberSequence += this._digit1;
			numberSequence += '  ';
			numberSequence += this._group1.join('');
			numberSequence += '  ';
			numberSequence += this._group2.join('');
			return numberSequence;
			//let numbers = parseInt(numberSequence, 10);
			//return numbers;
		}

		getBytes() {

			// |101| <- start marker (indexes 0 to 2)            |010 10| <- middle marker (indexes 45 to 49)          |101| <- end marker (indexes 92 to 94)
			//  10100000 00000000 00000000 00000000 00000000 00000010 10000000 00000000 00000000 00000000 00000000 00001010;

			const byteSize = 8; // byte array byte size. Uint8 byte has 8 bits
			const byteBuffer = new ArrayBuffer(96 / byteSize); // enough to fit 94 bits
			const byteArray = new Uint8Array(byteBuffer);

			const digitCodeSize = 7; // digit code has 7 bits
			let digitCode = 0;

			let streamIndex = 0;

			let groupParityBit;
			let groupParity;
			let groupParityBitIndex = 5; // group parity has 6 bits: indexes 0 to 5

			// start marker
			writeBytes(byteArray, 0b101, 3, streamIndex);

			// first group
			streamIndex = 3;
			for (let digit of this._group1) {

				groupParityBit = this._groupParity & (1 << groupParityBitIndex);

				if (groupParityBit !== 0) {
					digitCode = digitCodes[digit][1];
				} else {
					digitCode = digitCodes[digit][0];
				}

				writeBytes(byteArray, digitCode, digitCodeSize, streamIndex);
				streamIndex += digitCodeSize;
				groupParityBitIndex--;
			}

			// middle marker
			streamIndex = 45;
			writeBytes(byteArray, 0b01010, 5, streamIndex);

			// second group
			streamIndex = 50;
			for (let digit of this._group2) {
				digitCode = digitCodes[digit][2];
				writeBytes(byteArray, digitCode, digitCodeSize, streamIndex);
				streamIndex += digitCodeSize;
			}

			// end marker
			streamIndex = 92;
			writeBytes(byteArray, 0b101, 3, streamIndex);

			return byteArray;

		}

	};

	return IsbnBarCode;

});




define('ItfBarCode', ['writeBytes'], (writeBytes) => {

	/**
	 * Interleaved 2 of 5 digit width
	 * 0 = narrow
	 * 1 = wide
	 */
	const digitWidths = [
		0b00110, // 0
		0b10001, // 1
		0b01001, // 2
		0b11000, // 3
		0b00101, // 4
		0b10100, // 5
		0b01100, // 6
		0b00011, // 7
		0b10010, // 8
		0b01010  // 9
	];

	/**
	 * Interleaved 2 of 5 standard used by banks in Brazil
	 */
	const ItfBarCode = class {

		constructor() {

			Object.defineProperties(this, {
				length: {value: 316}, // TODO deixar dinâmica
				_digitSequence: {value: []}
			});

			Object.seal(this);

		}

		push(digitString) {
			let digit = Number.parseInt(digitString, 10);
			this._digitSequence.push(digit);
		}

		getNumbers() {
			return this._digitSequence.join('');
		}

		getBytes(ajustarParaBoleto) {

			const byteSize = 8; // byte array byte size. Uint8 byte has 8 bits
			const byteBuffer = new ArrayBuffer(320 / byteSize); // enough to fit 316 bits
			const byteArray = new Uint8Array(byteBuffer);

			const digitWidthsSize = 5; // digit widths have 5 bits

			let digitSequence = this._digitSequence;

			let barDigit = 0;
			let barDigitWidth = 0;

			let spaceDigit = 0;
			let spaceDigitWidth = 0;

			let digitBitIndex = 4;

			let streamIndex = 0;

			// remove os digitos verificadores
			if (ajustarParaBoleto) {
				let grupo1 = this._digitSequence.slice(0, 4); // identificação do banco (0-2) + código da moeda (3)
				let grupo2 = this._digitSequence.slice(32, 33); // dígito verificador geral
				let grupo3 = this._digitSequence.slice(33, 47); // fator de vencimento (33-36) + valor nominal (37-46)
				let grupo4 = this._digitSequence.slice(4, 9); // campo livre (4-8)
				let grupo5 = this._digitSequence.slice(10, 20); // campo livre (10-19)
				let grupo6 = this._digitSequence.slice(21, 31); // campo livre (21-30)
				digitSequence = [];
				digitSequence = digitSequence.concat(grupo1);
				digitSequence = digitSequence.concat(grupo2);
				digitSequence = digitSequence.concat(grupo3);
				digitSequence = digitSequence.concat(grupo4);
				digitSequence = digitSequence.concat(grupo5);
				digitSequence = digitSequence.concat(grupo6);
			}

			// start marker is (narrow bar, narrow space) 2x
			writeBytes(byteArray, 0b1010, 4, streamIndex);
			streamIndex += 4;

			for (let i = 0; i < digitSequence.length; i = i + 2) {

				for (digitBitIndex = 4; digitBitIndex >= 0; digitBitIndex--) {

					barDigit = digitSequence[i];
					barDigitWidth = digitWidths[barDigit] & (1 << digitBitIndex);
					// wide
					if (barDigitWidth) {
						writeBytes(byteArray, 0b11, 2, streamIndex);
						streamIndex += 2;
					// narrow
					} else {
						writeBytes(byteArray, 0b1, 1, streamIndex);
						streamIndex += 1;
					}

					spaceDigit = digitSequence[i + 1];
					spaceDigitWidth = digitWidths[spaceDigit] & (1 << digitBitIndex);
					// wide
					if (spaceDigitWidth) {
						writeBytes(byteArray, 0b00, 2, streamIndex);
						streamIndex += 2;
					// narrow
					} else {
						writeBytes(byteArray, 0b0, 1, streamIndex);
						streamIndex += 1;
					}

				}

			}

			// end marker is wide bar, narrow space, narrow bar
			writeBytes(byteArray, 0b1101, 4, streamIndex);
			streamIndex += 4;

			return byteArray;

		}

	};

	return ItfBarCode;

});



define('binaryBarCodeCanvas', () => {

	const binaryBarCodeCanvas = class {

		constructor(canvasId) {

			Object.defineProperties(this, {
				_canvas: {value: null, writable: true},
				_context: {value: null, writable: true}
			});

			this._canvas = document.getElementById(canvasId);
			this._context = this._canvas.getContext('2d');

			Object.seal();

		}

		/**
		 * @param byteArray Array of bytes containing the bar code bits
		 * @param length {Number} Length of byte array
		 * @param numbers {String} Text representation of the bar code
		 * @param baseWidth {Number}
		 * @param height {Number}
		 */
		paint(byteArray, length, numbers, baseWidth, height) {

			let x = 50;
			const y = 10;
			const byteSize = 8;
			const byteLength = Math.ceil(length / byteSize);
			let bit = 0;
			let bitMask = 0;
			let streamIndex = 0;
			//let marker = false;

			this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);

			for (let byteIndex = 0; byteIndex < byteLength; byteIndex++) {

				bitMask = 1 << (byteSize - 1);

				for (let bitIndex = 0; bitIndex < byteSize && streamIndex < length; bitIndex++) {

					bit = byteArray[byteIndex] & bitMask;

					// isbn
					/*if (streamIndex < 3
						|| (streamIndex > 44 && streamIndex < 50)
						|| (streamIndex > 91)
						) {

						marker = true;

					} else {

						marker = false;

					}*/

					if (bit) {
						this._context.fillRect(x, y, baseWidth, height /*+ (marker ? 20 : 0)*/);
					}

					x += baseWidth;

					bitMask >>= 1;
					streamIndex++;

				}

			}

			this._context.font = '20px Consolas';
			this._context.fillText(numbers, 50, y + height + 19);

		}

	};

	return binaryBarCodeCanvas;

});



// main

define([

	'IsbnBarCode',
	'ItfBarCode',
	'binaryBarCodeCanvas'

	], (

	IsbnBarCode,
	ItfBarCode,
	binaryBarCodeCanvas

	) => {



	// supermercado

	const inputISBNCode = document.getElementById('isbnCode');
	const buttonGenerateISBNBarCode = document.getElementById('generateISBNBarCode');

	buttonGenerateISBNBarCode.addEventListener('click', (clickEvent) => {

		let isbnCode = inputISBNCode.value;
		isbnCode = isbnCode.replace(/\D/gi, ''); // somente números

		const barCode = new IsbnBarCode();

		for (let digit of isbnCode) {
			barCode.push(digit);
		}

		const barCodeCanvas = new binaryBarCodeCanvas('binaryBarCodeCanvas');
		barCodeCanvas.paint(barCode.getBytes(), barCode.length, barCode.getNumbers(), 3, 85);

	});



	// boleto

	const inputITFCode = document.getElementById('itfCode');
	const checkboxAjustarBoletoITFCode = document.getElementById('ajustarBoletoItfCode');
	const buttonGenerateITFBarCode = document.getElementById('generateITFBarCode');

	buttonGenerateITFBarCode.addEventListener('click', (clickEvent) => {

		let itfCode = inputITFCode.value;
		itfCode = itfCode.replace(/\D/gi, ''); // somente números

		const ajustarBoleto = checkboxAjustarBoletoITFCode.checked;

		const barCode = new ItfBarCode();

		for (let digit of itfCode) {
			barCode.push(digit);
		}

		const barCodeCanvas = new binaryBarCodeCanvas('binaryBarCodeCanvas');
		barCodeCanvas.paint(barCode.getBytes(ajustarBoleto), barCode.length, barCode.getNumbers(), 3, 85);

	});



	/*
	(() => {
		const byteSize = 8;
		const arraySizeInBits = 96;
		const arraySizeInBytes = arraySizeInBits / byteSize;
		const byteBuffer = new ArrayBuffer(arraySizeInBytes);
		const byteArray = new Uint8Array(byteBuffer);
		//const byteArray = new Uint16Array(byteBuffer);

		writeBytes(byteArray, 0b01010, 5, 46);
		readBytes(byteArray, null, arraySizeInBytes, 0);
	})();
	*/



});