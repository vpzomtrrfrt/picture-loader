const sharp = require('sharp');
const loaderUtils = require('loader-utils');
const mime = require('mime');

module.exports = function(content, map, meta) {
	const callback = this.async();
	const resourceQuery = this.resourceQuery ? loaderUtils.parseQuery(this.resourceQuery) : {};
	const config = Object.assign({}, loaderUtils.getOptions(this), resourceQuery);

	if(!config.formats) return callback(new Error("formats missing"));
	if(!config.sizes) return callback(new Error("sizes missing"));

	let useHeight;

	if(config.useHeight) {
		if(typeof config.useHeight === "string") {
			if(config.useHeight === "true") useHeight = true;
			else if(config.useHeight === "false") useHeight = false;
			else {
				return callback(new Error("Invalid value for useHeight"));
			}
		}
		else if(typeof config.useHeight === "boolean") {
			useHeight = config.useHeight;
		}
		else {
			return callback(new Error("Invalid value for useHeight"));
		}
	}
	else {
		useHeight = false;
	}

	let lossless = config.lossless ?? true;

	const name = '[hash]-[size].[ext]';
	const formats = (Array.isArray(config.formats) ? config.formats : config.formats.split(","));
	const sizes = (Array.isArray(config.sizes) ? config.sizes : config.sizes.split(","))
		.map(x=>parseInt(x));

	const img = sharp(this.resourcePath);
	img.metadata()
	.then(metadata => {
		return Promise.all(formats.map(format => {
			return Promise.all(sizes.map(size => new Promise((resolve, reject) => {
				img.resize(
					useHeight ? null : size,
					useHeight ? size : null,
				)
				.toFormat(format, {lossless})
				.toBuffer((err, output) => {
					if(err) return reject(err);
					resolve(output);
				});
			})
				.then(buffer => {
					const fileName = loaderUtils.interpolateName(
						this,
						name.replace(/\[ext\]/ig, format),
						{
							content: content
						}
					)
					.replace(/\[size\]/ig, size);

					this.emitFile(fileName, buffer);

					return {
						src: '__webpack_public_path__ + ' + JSON.stringify(fileName),
						size,
						format: JSON.stringify(format),
						mime: JSON.stringify(mime.getType("."+format))
					};
				})
			));
		}))
		.then(results => [].concat.apply([], results));
	})
		.then(results => {
			const array = results.map(file => '{src:' + file.src + ',format:' + file.format + ',size:' + file.size + ',mime:' + file.mime + '}').join(',');

			callback(null, 'module.exports={images:[' + array + ']};');
		})
		.catch(callback);
};

module.exports.raw = true;
