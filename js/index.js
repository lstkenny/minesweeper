class SpriteSheet
{
	constructor(name)
	{
		this.sprites = {};
	}

	loadSprite(name)
	{
		return fetch('sprites/' + name + '.json')
		.then(response => response.json())
		.then(json => {
			this.sprites[name] = {};
			this.sprites[name].data = json;
			return this.preloadImage(name, json.url);
		});
	}

	preloadImage(name, path) 
	{
		let image = new Image();
		image.src = path;
		this.sprites[name].image = image;

		return new Promise(function (resolve, reject) {
			image.onload  = resolve;
			image.onerror = resolve;
		});
	}

	drawTile(context, sprite, name, x, y)
	{
		let tile = this.sprites[sprite].data.tiles[name];
		let pos = this.sprites[sprite].data.pos;
		let image = this.sprites[sprite].image;

		context.drawImage(image, 
			pos.x + tile[0] * pos.w, 
			pos.y + tile[1] * pos.h, 
			pos.w, pos.h, 
			x, y, pos.w, pos.h);
	}

	drawScore(context, score, x, y)
	{
		let text = score.toString();
		let w = this.sprites.scores.data.pos.w;
		for (let i = 0; i < text.length; i++) {
			this.drawTile(context, 'scores', text.charAt(i), x + i * w, y);
		}
	}

	drawButton(context, name, x, y)
	{
		this.drawTile(context, 'buttons', name, x, y);
	}

	drawCell(context, name, x, y)
	{
		let pos = this.sprites.cells.data.pos;
		this.drawTile(context, 'cells', name, x * pos.w, y * pos.h);
	}
}

class Cell
{
	constructor(x, y)
	{
		this.x = x;
		this.y = y;
		this.state = 'blank';
		this.value = 0;
		this.mine = false;
		this.revealed = false;
	}

	setValue(val)
	{
		this.value = val;
	}

	mark()
	{
		if (this.revealed)
		{
			return;
		}
		let states = ['blank', 'flag', 'unkn'];
		let i = states.indexOf(this.state);
		this.state = states[(i + 1) % states.length];
	}

	reveal()
	{
		this.revealed = true;
		this.state = 'blank';
		return this.value;
	}

	draw(context, sprite)
	{
		let state = this.state;
		if (this.revealed)
		{
			state = this.value;
		}
		sprite.drawCell(context, state, this.x, this.y);
	}
}

class Grid
{
	constructor(mode)
	{
		this.width = mode.w;
		this.height = mode.h;
		this.mines = mode.m;
		this.init();
	}

	init()
	{
		//set grid
		this.cells = new Array(this.width);
		for (let x = 0; x < this.width; x++)
		{
			this.cells[x] = new Array(this.height);
		}
		//set cells
		for (let x = 0; x < this.width; x++)
		{
			for (let y = 0; y < this.height; y++)
			{
				this.cells[x][y] = new Cell(x, y);
			}
		}
		//set mines
		for (let i = 0; i < this.mines; i++)
		{
			let x = 0, y = 0;
			do {
				x = Math.floor(Math.random() * this.width);
				y = Math.floor(Math.random() * this.height);
			} while (this.cells[x][y].mine == true);
			this.cells[x][y].mine = true;
		}
		//set values
		for (let x = 0; x < this.width; x++)
		{
			for (let y = 0; y < this.height; y++)
			{
				this.cells[x][y].setValue(this.getValue(x, y));
			}
		}
	}

	outOfBounds(val, dimension)
	{
		return (val < 0 || val >= this[dimension]);
	}

	eachNeighbor(x, y, callback)
	{
		for (let i = -1; i < 2; i++)
		{
			let xx = x + i;
			if (this.outOfBounds(xx, 'width'))
			{
				continue;
			}
			for (let j = -1; j < 2; j++)
			{
				let yy = y + j;

				if (x == xx && y == yy)
				{
					continue;
				}
				if (this.outOfBounds(yy, 'height'))
				{
					continue;
				}
				callback(xx, yy);
			}
		}
	}

	getValue(x, y)
	{
		if (this.cells[x][y].mine)
		{
			return 'mine';
		}
		let value = 0;
		let cells = this.cells;

		this.eachNeighbor(x, y, (xx, yy) => {
			if (cells[xx][yy].mine)
			{
				value++;
			}
		});

		return value;
	}

	mark(x, y)
	{
		this.cells[x][y].mark();
	}

	reveal(x, y)
	{
		if (this.cells[x][y].revealed || this.cells[x][y].state == 'flag')
		{
			return false;
		}
		let val = this.cells[x][y].reveal();

		if (val == 'mine') 
		{
			this.explode(x, y);
		}
		else if (val == 0)
		{
			this.eachNeighbor(x, y, (xx, yy) => {
				this.reveal(xx, yy);
			});
		}
		return val;
	}

	revealNeighbors(x, y)
	{
		let val = 0, sum = 0;

		let cell = this.cells[x][y];

		if (!cell.revealed)
		{
			return val;
		}

		this.eachNeighbor(x, y, (xx, yy) => {
			if (this.cells[xx][yy].state == 'flag')
			{
				sum++;
			}
		});

		if (sum != cell.value)
		{
			return val;
		}

		this.eachNeighbor(x, y, (xx, yy) => {
			if (this.reveal(xx, yy) == 'mine')
			{
				val = 'mine';
			}
		});
		return val;
	}

	revealAll()
	{
		for (let x = 0; x < this.width; x++)
		{
			for (let y = 0; y < this.height; y++)
			{
				if (this.cells[x][y].state == 'flag' && !this.cells[x][y].mine)
				{
					this.cells[x][y].value = 'wrong';
					this.cells[x][y].reveal();

				}
				if (this.cells[x][y].state == 'blank' && this.cells[x][y].mine)
				{
					this.cells[x][y].reveal();
				}
			}
		}
	}

	explode(x, y)
	{
		this.cells[x][y].setValue('mine_p');
		this.revealAll();
	}
	
	draw(context, sprite)
	{
		for (let x = 0; x < this.width; x++)
		{
			for (let y = 0; y < this.height; y++)
			{
				this.cells[x][y].draw(context, sprite);
			}
		}
	}
}

class Game
{
	constructor(mode)
	{
		this.modes = {
			'easy' : {
				w: 9,
				h: 9,
				m: 10
			},
			'medium' : {
				w: 16,
				h: 16,
				m: 40
			},
			'difficult' : {
				w: 30,
				h: 16,
				m: 99
			}
		};

		this.mode = mode;
		this.gameOver = false;
		this.active = new Array(3).fill(false);
		this.grid = new Grid(this.modes[mode]);
	}

	getGridCoord(pos)
	{
		return {
			x: Math.floor(pos.x / 16),
			y: Math.floor(pos.y / 16)
		};
	}

	click(pos)
	{
		pos = this.getGridCoord(pos);

		let val = 0;

		//reveal neighbors
		if (this.active[2] != false)
		{
			if (pos.x == this.active[2].x && pos.y == this.active[2].y)
			{
				val = this.grid.revealNeighbors(pos.x, pos.y);
			}
		}
		else
		{
			val = this.grid.reveal(pos.x, pos.y);
		}

		//explode
		if (val == 'mine')
		{
			this.gameOver = true;
		}
	}

	rightClick(pos)
	{
		pos = this.getGridCoord(pos);
		this.grid.mark(pos.x, pos.y);
	}

	pressed(pos, button)
	{
		this.active[button] = this.getGridCoord(pos);
	}

	released(pos, button)
	{
		this.active[button] = false;
	}

	draw(context, sprite)
	{
		context.fillStyle = '#fff';
		context.fillRect(
			0, 
			0, 
			context.canvas.clientWidth, 
			context.canvas.clientHeight
		);
		this.grid.draw(context, sprite);
	}
}

function getClickPos(element, event)
{
	let rect = element.getBoundingClientRect();
	let pos = {
		x: event.clientX - rect.left,
		y: event.clientY - rect.top
	};
	return pos;
}

document.addEventListener("DOMContentLoaded", function() {

	//init canvas
	const canvas = document.createElement("canvas");
	document.body.appendChild(canvas);
	canvas.setAttribute("width", 480);
	canvas.setAttribute("height", 400);
	const context = canvas.getContext("2d");

	//load sprites
	let sprite = new SpriteSheet();

	Promise.all([
		sprite.loadSprite('scores'), 
		sprite.loadSprite('buttons'), 
		sprite.loadSprite('cells')
	]).then(() => {
		const game = new Game('difficult');
		game.draw(context, sprite);

		canvas.addEventListener('mousedown', function(event) {
			game.pressed(getClickPos(canvas, event), event.button);
		});		

		canvas.addEventListener('mouseup', function(event) {
			game.released(getClickPos(canvas, event), event.button);
		});

		//Binding the click event on the canvas
		canvas.addEventListener('click', function(event) {

			game.click(getClickPos(canvas, event));

			game.draw(context, sprite);

		}, false);

		//Binding the right click on the canvas
		canvas.addEventListener('contextmenu', function(event) {

			event.preventDefault();

			game.rightClick(getClickPos(canvas, event));

			game.draw(context, sprite);

			return false;
		}, false);
/*
		sprite.drawScore(context, '0123456789', 0, 10);

		let buttons = [
			"happy",
			"pressed",
			"scared",
			"win",
			"dead"
		];		
		for (let i = 0; i < buttons.length; i++)
		{
			sprite.drawButton(context, buttons[i], i * 26, 40);
		}


		let cells = [
			"blank",
			"0",
			"flag",
			"unkn",
			"unkn_p",
			"mine",
			"mine_p",
			"wrong"
		];

*/
	});

});