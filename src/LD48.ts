import {myGraph} from "./graph/Graph";
import {Diagnostics, Entity, Game, MathUtil, Scene, Sprite, SpriteSheet, TextDisp} from "lagom-engine";
import spritesheet from './Art/spritesheet.png';

const sprites = new SpriteSheet(spritesheet, 16, 16);

enum Layers
{
    BACKGROUND,
    ELEVATOR_DOOR,
    GUYS,
    SCORE
}


export class LD48 extends Game
{
    constructor()
    {
        super({width: 640, height: 360, resolution: 2, backgroundColor: 0xd95763});
        this.setScene(new MainScene(this));
    }
}

class MainScene extends Scene
{
    onAdded()
    {
        myGraph();

        super.onAdded();

        this.addEntity(new MoneyBoard(50, 50, 1000));
        this.addEntity(new Guy("guy", 100, 100, Layers.GUYS));
        this.addGUIEntity(new Diagnostics("white", 5, true));

        this.addBackground();
        this.makeFloors();
    }

    private makeFloors()
    {
        for (let i = 0; i < 7; i++)
        {
            for (let j = 0; j < 4; j++)
            {
                this.addEntity(new ElevatorDoor("door", 100 + 150 * j, i * 40 + 40, Layers.ELEVATOR_DOOR));
            }
        }
    }

    private addBackground()
    {
        const background = this.addEntity(new Entity("background", 0, 0, Layers.BACKGROUND));

        for (let i = 0; i < 640 / 16; i++)
        {
            for (let j = 0; j < 360 / 16; j++)
            {
                background.addComponent(new Sprite(sprites.texture(2 + MathUtil.randomRange(0, 5), 0, 16, 16),
                    {xOffset: i * 16, yOffset: j * 16}));
            }
        }
    }
}

class MoneyBoard extends Entity
{
    private currentMoney: number;
    private label: TextDisp;

    constructor(x: number, y: number, initialMoney: number)
    {
        super("MoneyBoard", x, y, Layers.SCORE);
        this.currentMoney = initialMoney;
        this.label = new TextDisp(-30, 0, this.getScoreText(), {fill: 0xffffff});
    }

    onAdded()
    {
        super.onAdded();
        this.addComponent(this.label);
    }

    getScoreText()
    {
        return "$" + this.currentMoney.toString();
    }

    public modifyAmount(modifier: number)
    {
        this.currentMoney += modifier;
        this.label.pixiObj.text = this.getScoreText();
    }
}

class Guy extends Entity
{
    onAdded()
    {
        super.onAdded();

        this.addComponent(new Sprite(sprites.texture(0, 0, 8, 8)));
    }
}

class ElevatorDoor extends Entity
{
    onAdded()
    {
        super.onAdded();

        this.addComponent(new Sprite(sprites.textureFromIndex(1)));
    }
}