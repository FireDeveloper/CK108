/**
 * @file ink.ts
 * @brief Readable text colour on an arbitrary fill: black or white, whichever has the higher WCAG contrast against it.
 * @note The better of the two always reaches at least 4.58:1, whatever the fill.
 */

//& Public Functions

/**
 * @brief Pick black or white text for a fill colour.
 * @param[in] color "#rrggbb" fill.
 * @return "#000000" or "#ffffff", whichever contrasts more with the fill.
 */
export function inkFor(color: string): string {
	const luminance = relativeLuminance(color); // fill brightness, 0 black to 1 white
	const blackContrast = (luminance + 0.05) / 0.05; // black text on this fill
	const whiteContrast = 1.05 / (luminance + 0.05); // white text on this fill
	return blackContrast >= whiteContrast ? '#000000' : '#ffffff'; // stronger of the two
}

//& Private Functions

/**
 * @brief WCAG relative luminance of a colour.
 * @param[in] color "#rrggbb".
 * @return 0 for black up to 1 for white.
 */
function relativeLuminance(color: string): number {
	const [red, green, blue] = [1, 3, 5].map((at) => linear(parseInt(color.slice(at, at + 2), 16) / 255)); // linear channel values
	return 0.2126 * red + 0.7152 * green + 0.0722 * blue; // weighted by eye sensitivity
}

/**
 * @brief Undo the sRGB transfer curve for one channel.
 * @param[in] channel Channel value, 0..1.
 * @return Linear light, 0..1.
 */
function linear(channel: number): number {
	return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; // sRGB to linear light
}
