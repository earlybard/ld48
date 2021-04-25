import {getNodeName, HellGraph} from "./graph/Graph";
import {
    CircleCollider,
    CollisionMatrix,
    CollisionSystem,
    Component,
    Diagnostics,
    DiscreteCollisionSystem,
    Entity,
    FrameTriggerSystem,
    Game,
    GlobalSystem,
    LagomType,
    Log,
    LogLevel,
    MathUtil,
    Mouse,
    RenderCircle,
    Scene,
    Sprite,
    SpriteSheet,
    TextDisp,
    Timer,
    TimerSystem
} from "lagom-engine";
import spritesheet from './Art/spritesheet.png';
import roomsheet from './Art/chambers.png';
import {DoorStateSystem, ElevatorDestroyer, ElevatorDropper, ElevatorMover} from "./Elevator";
import {GraphLocation, GraphTarget, Guy, GuyMover, Path, Pathfinder} from "./Guy/Guy";
import {FloorNode} from "./graph/FloorNode";
import {GuySpawner} from "./Guy/GuySpawner";

export const sprites = new SpriteSheet(spritesheet, 16, 16);
export const rooms = new SpriteSheet(roomsheet, 150, 64);

export enum Layers
{
    BACKGROUND,
    ELEVATOR,
    ELEVATOR_DOOR,
    ELEVATOR_NODE,
    GUYS,
    SCORE,
    MOUSE
}

Log.logLevel = LogLevel.ALL;

export const hellLayout = [
    [3, 1, 0],
    [1, -1, 2],
    [0, 2, 1],
    [3, -1, 3],
    [1, 0, 2]
];

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
        // graph.printGraph()
        // const result = graph.pathfind(getNodeName("FLOOR", 1, 1), getNodeName("FLOOR", 4, 3))
        // console.log(result)

        super.onAdded();

        const graph = this.addEntity(new HellGraph());
        graph.initGraph();

        const collisionMatrix = new CollisionMatrix();
        collisionMatrix.addCollision(Layers.MOUSE, Layers.ELEVATOR_NODE);
        this.addGlobalSystem(new DiscreteCollisionSystem(collisionMatrix));
        this.addGlobalSystem(new MouseEventSystem());

        const initialBudget = 1000;
        const initialEnergyCost = 0;

        this.addGlobalSystem(new TimerSystem());
        this.addGlobalSystem(new FrameTriggerSystem());

        this.addSystem(new DoorStateSystem());
        this.addSystem(new ElevatorMover());
        this.addSystem(new ElevatorDropper());
        this.addSystem(new ElevatorDestroyer());

        this.addEntity(new GameManager(initialBudget, initialEnergyCost));
        this.addEntity(new MoneyBoard(50, 50, 1000));
        this.addEntity(new PowerUseBoard(600, 10, initialEnergyCost));

        this.addSystem(new GuySpawner());
        this.addSystem(new Pathfinder());
        this.addSystem(new GuyMover());

        this.addGUIEntity(new Diagnostics("white", 5, true));
        this.addEntity(new ElevatorNodeManager("Node Manager", 0, 0, Layers.ELEVATOR_NODE));

        this.addBackground();
    }

    private addBackground()
    {
        const background = this.addEntity(new Entity("background", 0, 0, Layers.BACKGROUND));

        for (let i = 0; i < 640 / 16; i++)
        {
            for (let j = 0; j < 360 / 16; j++)
            {
                background.addComponent(new Sprite(sprites.texture(1 + MathUtil.randomRange(0, 7), 0, 16, 16),
                    {xOffset: i * 16, yOffset: j * 16}));
            }
        }

        // Elevator Shafts
        for (let i = 0; i < 4; i++)
        {
            for (let j = 0; j < 360 / 16; j++)
            {
                background.addComponent(new Sprite(sprites.texture(MathUtil.randomRange(0, 3), 1, 16, 16),
                    {xOffset: 100 + 150 * i, yOffset: j * 16}));
            }
        }

        // Rooms
        for (let i = 0; i < 5; i++)
        {
            for (let j = 0; j < 3; j++)
            {
                const room = hellLayout[i][j];

                if (room === -1) continue;
                background.addComponent(new Sprite(rooms.texture(0, room),
                    {xOffset: 8 + 100 + 150 * j, yOffset: i * 70 + 3}));
            }
        }
    }
}

class MouseColl extends Entity
{
    onAdded(): void
    {
        super.onAdded();

        const sys = this.getScene().getGlobalSystem<CollisionSystem>(CollisionSystem);
        if (sys !== null)
        {
            this.addComponent(new CircleCollider(sys, {layer: Layers.MOUSE, radius: 5}));
        }
        this.addComponent(new Timer(60, null, false)).onTrigger.register(caller => {
            caller.getEntity().destroy();
        });
    }
}

class MouseEventSystem extends GlobalSystem
{
    types(): LagomType<Component>[]
    {
        return [];
    }

    update(delta: number): void
    {
        if (Mouse.isButtonPressed(0))
        {
            const where = this.scene.camera.viewToWorld(Mouse.getPosX(), Mouse.getPosY());
            this.getScene().addEntity(new MouseColl("mouse", where.x, where.y));
        }
    }
}

class GameManager extends Entity
{
    initialBudget: number;
    initialEnergyUse: number;

    constructor(initialBudget: number, initialEnergyUse: number)
    {
        super("Manager");
        this.initialBudget = initialBudget;
        this.initialEnergyUse = initialEnergyUse;
    }

    onAdded()
    {
        super.onAdded();
        this.addComponent(new Budget(this.initialBudget));
        this.addComponent(new EnergyUsed(this.initialEnergyUse));
    }
}

class Budget extends Component
{
    moneyLeft: number;

    constructor(initialBudget: number)
    {
        super();
        this.moneyLeft = initialBudget;
    }
}

class EnergyUsed extends Component
{
    energyUsed: number;

    constructor(initialEnergyUse: number)
    {
        super();
        this.energyUsed = initialEnergyUse;
    }
}

class MoneyBoard extends Entity
{
    private readonly label: TextDisp;

    constructor(x: number, y: number, private readonly initialMoney: number)
    {
        super("MoneyBoard", x, y, Layers.SCORE);
        this.label = new TextDisp(0, 0, this.getScoreText(initialMoney), {fill: 0xffffff});
    }

    onAdded()
    {
        super.onAdded();
        this.addComponent(this.label);
    }

    private getScoreText(newMoney: number)
    {
        return "$" + newMoney.toString();
    }

    public updateMoney(newMoney: number)
    {
        this.label.pixiObj.text = this.getScoreText(newMoney);
    }
}

class PowerUseBoard extends Entity
{
    constructor(x: number, y: number, private readonly initialValue: number)
    {
        super("power", x, y, Layers.SCORE);
    }

    onAdded()
    {
        super.onAdded();
        const textbox = new TextDisp(0, 0, this.initialValue.toString(), {fill: 0xffffff});
        this.addComponent(textbox);
    }
}

class ElevatorDoor extends Entity
{
    onAdded() {
        super.onAdded();

        this.addComponent(new Sprite(sprites.textureFromIndex(1)));
    }
}

class ElevatorNodeManager extends Entity
{
    private shafts: ElevatorNode[][] = [];
    private droppers: ElevatorDropButton[] = [];

    onAdded()
    {
        super.onAdded();

        for (let shaft = 0; shaft < 4; shaft++)
        {
            const nodes = [];
            for (let level = 0; level < 5; level++)
            {
                const node = new ElevatorNode(shaft, level);
                nodes.push(node);
                this.addChild(node);
            }
            this.shafts.push(nodes);
        }
        console.log(this.shafts)
        const sys = this.getScene().getGlobalSystem<CollisionSystem>(CollisionSystem);
        if (sys !== null) {
            this.shafts.forEach(shaft => shaft.forEach(node => {
                    const buttonColl = node.addComponent(
                        new CircleCollider(sys, {radius: 10, layer: Layers.ELEVATOR_NODE}));
                    buttonColl.onTriggerEnter.register((caller, data) => {
                        if (data.other.layer === Layers.MOUSE) {
                            if (node.selected)
                            {
                                node.deselect();
                            }
                            else if (shaft.indexOf(node) > -1)
                            {
                                const selectedNodes = shaft.filter(node => node.selected);

                                if (selectedNodes.length == 1)
                                {
                                    const firstNode = selectedNodes[0];
                                    const start = Math.min(node.level, firstNode.level);
                                    const end = Math.max(node.level, firstNode.level);
                                    if (this.parent != null) {

                                        const graph = this.scene.getEntityWithName<HellGraph>("HellGraph");
                                        if (!graph) return

                                        graph.addElevator(start, end, node.shaft, this.parent.getScene());

                                        const nodesInShaft = shaft/*.filter(node => node.level>= start && node.level <= end)*/;
                                        nodesInShaft.forEach(node => node.hide());

                                        const dropButton = new ElevatorDropButton(node.shaft,start);
                                        this.addChild(dropButton);
                                        const buttonColl = dropButton.addComponent(
                                            new CircleCollider(sys, {radius: 10, layer: Layers.ELEVATOR_NODE}));
                                        buttonColl.onTriggerEnter.register((caller, data) => {
                                            if (data.other.layer === Layers.MOUSE) {
                                                dropButton.destroy();
                                                shaft.filter(node => node.hidden).forEach(node => node.show());
                                            }
                                        });
                                        this.droppers.push(dropButton)

                                    }
                                }
                                else if (selectedNodes.length == 0)
                                {
                                    node.select();
                                }
                            }
                        }
                    });
                }

            ))

        }
    }
}

class ElevatorNode extends Entity
{
    private _selected = false;
    private _hidden = false;
    private circle: Component = new Sprite(sprites.texture(3, 1, 16, 16));

    level: number
    shaft: number

    constructor(shaft: number, level: number)
    {
        super(getNodeName("ELEVATOR", level, shaft), 100 + 150 * shaft, level * 70 + 50, Layers.ELEVATOR_DOOR);
        this.level = level;
        this.shaft = shaft;
    }

    get selected(): boolean {
        return this._selected;
    }

    get hidden(): boolean {
        return this._hidden;
    }

    onAdded() {
        super.onAdded();
        this.addComponent(this.circle)
    }

    select()
    {
        this._selected = true;
        this.removeComponent(this.circle, true);
        this.circle =  new Sprite(sprites.texture(4, 1, 16, 16));
        this.addComponent(this.circle)
    }

    deselect()
    {
        this._selected = false;
        this.removeComponent(this.circle, true);
        this.circle = new Sprite(sprites.texture(3, 1, 16, 16));
        this.addComponent(this.circle)
    }

    hide()
    {
        this._hidden = true;
        this._selected = false;
        this.removeComponent(this.circle, true);
    }

    show()
    {
        this._hidden = false;
        this.circle = new Sprite(sprites.texture(3, 1, 16, 16));
        this.addComponent(this.circle)
    }
}

class ElevatorDropButton extends Entity
{
    level: number
    shaft: number

    constructor(shaft: number, level: number)
    {
        super(getNodeName("DROP", level, shaft), 80 + 150 * shaft, level * 70 + 50, Layers.ELEVATOR_DOOR);
        this.level = level;
        this.shaft = shaft;
    }

    onAdded() {
        super.onAdded();
        this.addComponent(new RenderCircle(0, 0, 5, 0xff0000, 0x000000));
    }
}

// class ElevatorCreator extends GlobalSystem
// {
//     types(): LagomType<ElevatorNode>[] {
//         return [];
//     }
//
//     update(delta: number)
//     {
//
//     }
// }