'use strict';



const toBinaryString = (number, byteSize) => {

	let binaryString = '0b';
	let paddedBinary = '00000000';

	paddedBinary += number.toString(2);
	paddedBinary = paddedBinary.substr(paddedBinary.length - byteSize, byteSize);
	binaryString += paddedBinary;

	return binaryString;

};



const writeBytes = (byteArray, bytes, length, offset) => {

	const byteSize = 8;
	const arraySizeInBytes = byteArray.buffer.byteLength;
	const elementSizeInBytes = byteArray.BYTES_PER_ELEMENT;
	const elementSizeInBits = elementSizeInBytes * byteSize;

	let byteIndex = Math.floor(offset / elementSizeInBits);
	let bitIndex = ((offset + elementSizeInBits) % elementSizeInBits);
	let loop = false;

	// bits are aligned right aligned, so the offset must be enough to align the left sides
	let bitOffset = elementSizeInBits - length - bitIndex;

	// bitwise operators are limited to 32 bits

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

		// if there are no more bytes to record
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

// read part
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



/**
 * 0 = L
 * 1 = G
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
 * 0 = L
 * 1 = G
 * 2 = R
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



const IsbnBarCode = class {

	constructor() {

		Object.defineProperties(this, {
			digit1: {value: -1, writable: true},
			group1: {value: []},
			group2: {value: []},
			_groupParity: {value: -1, writable: true}
		});

		Object.seal(this);

	}

	push(digitString) {

		let digit = Number.parseInt(digitString, 10);

		if (this.digit1 === -1) {
			this.digit1 = digit;
			this._groupParity = digitsGroup1Parity[this.digit1];
		} else if (this.group1.length < 6) {
			this.group1.push(digit);
		} else if (this.group2.length < 6) {
			this.group2.push(digit);
		}

	}

	getNumbers() {
		let numberSequence = '';
		numberSequence += this.digit1;
		numberSequence += '  ';
		numberSequence += this.group1.join('');
		numberSequence += '  ';
		numberSequence += this.group2.join('');
		return numberSequence;
		//let numbers = parseInt(numberSequence, 10);
		//return numbers;
	}

	getBytes() {

		// |101| <- start marker (indexes 0 to 2)            |010 10| <- middle marker (indexes 45 to 49)          |101| <- end marker (indexes 92 to 94)
		//  10100000 00000000 00000000 00000000 00000000 00000010 10000000 00000000 00000000 00000000 00000000 00001010;

		const byteSize = 8;
		const byteBuffer = new ArrayBuffer(96 / byteSize);
		const byteArray = new Uint8Array(byteBuffer);

		const digitCodeSize = 7;
		let digitCode = 0;

		let streamIndex = 0;

		let groupParityBit;
		let groupParity;
		let groupParityBitIndex = 5;

		// start marker
		writeBytes(byteArray, 0b101, 3, streamIndex);

		// first group
		streamIndex = 3;
		for (let digit of this.group1) {

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
		for (let digit of this.group2) {
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

	paint(byteArray, numbers, baseWidth, height) {

		let x = 50;
		const y = 10;
		let bit = 0;
		let bitMask = 0;
		let streamIndex = 0;
		let marker = false;

		this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);

		for (let byteIndex = 0; byteIndex < 12; byteIndex++) {

			bitMask = 1 << 7;

			for (let bitIndex = 0; bitIndex < 8 && streamIndex < 95; bitIndex++) {

				bit = byteArray[byteIndex] & bitMask;

				if (streamIndex < 3
					|| (streamIndex > 44 && streamIndex < 50)
					|| (streamIndex > 91)
					) {

					marker = true;

				} else {

					marker = false;

				}

				if (bit) {
					this._context.fillRect(x, y, baseWidth, height + (marker ? 20 : 0));
				}

				x += baseWidth;

				bitMask >>= 1;
				streamIndex++;

			}

		}

		this._context.font = '20px Consolas';
		this._context.fillText(numbers, 37, y + height + 19);

	}

};



const inputISBNCode = document.getElementById('isbnCode');
const buttonGenerateISBNBarCode = document.getElementById('generateISBNBarCode');

buttonGenerateISBNBarCode.addEventListener('click', (clickEvent) => {

	let isbnCode = inputISBNCode.value;
	isbnCode = isbnCode.replace(/\D/gi, '');

	const barCode = new IsbnBarCode();

	for (let digit of isbnCode) {
		barCode.push(digit);
	}

	const barCodeCanvas = new binaryBarCodeCanvas('binaryBarCodeCanvas');
	barCodeCanvas.paint(barCode.getBytes(), barCode.getNumbers(), 3, 85);

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