import { hash } from '@node-rs/argon2';

function promptHidden(question) {
	return new Promise((resolve, reject) => {
		if (!process.stdin.isTTY) {
			reject(new Error('hash-password needs an interactive terminal (with Docker, use `docker compose run --rm -it`)'));
			return;
		}
		process.stdin.setRawMode(true);
		process.stdin.resume();
		process.stdout.write(question);
		process.stdin.setEncoding('utf8');
		let input = '';
		const onData = (chunk) => {
			for (const character of chunk) {
				if (character === '\u0003') {
					process.stdout.write('\n');
					process.exit(130);
				}
				if (character === '\r' || character === '\n') {
					process.stdin.setRawMode(false);
					process.stdin.pause();
					process.stdin.off('data', onData);
					process.stdout.write('\n');
					resolve(input);
					return;
				}
				input = character === '\u007f' ? input.slice(0, -1) : input + character;
			}
		};
		process.stdin.on('data', onData);
	});
}

const password = await promptHidden('Admin password: ');
if (password.length < 12) {
	console.error('Password must be at least 12 characters.');
	process.exit(1);
}
if ((await promptHidden('Repeat password: ')) !== password) {
	console.error('Passwords do not match.');
	process.exit(1);
}

const passwordHash = await hash(password);
if (!passwordHash.startsWith('$argon2id$')) throw new Error(`Expected an argon2id hash, got ${passwordHash}`);
console.log(passwordHash);
