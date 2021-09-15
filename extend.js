module.exports = function(a, b) {


	Array.prototype.slice.call(arguments, 1).forEach((b) => {
		b = b || {};
		Object.keys(b).forEach((k) => {
			a[k] = b[k];
		});
	});
	return a;
}