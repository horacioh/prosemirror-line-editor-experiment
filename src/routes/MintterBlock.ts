import {DecoratorNode, LexicalNode, NodeKey} from 'lexical';

export class MintterBlock extends DecoratorNode<HTMLElement> {
	__child: any
	__id: string

	static getType(): string {
		return 'mintter-block';
	}

	// static clone(node: VideoNode): VideoNode {
	static clone(node: MintterBlock): MintterBlock {
		console.log('MintterBlock: clone()', node)
		return new MintterBlock(node.__child, node.__id)
	}

	constructor(child: any, id: string, key?: NodeKey) {
		super(key);
		this.__child = child
		this.__id = id
	}

	createDOM(): HTMLElement {
		let wrapper = document.createElement('div');
		wrapper.id = this.__child.miid
		this.__child.mount({container: wrapper})
		return wrapper
	}

	updateDOM(): false {
		console.log('MintterBlock: updateDOM()')
		return false;
	}

	decorate() {
		console.log('MintterBlock: createDOM()')
		let wrapper = document.createElement('div');

		return wrapper
	}
}

export function $createMintterBlock(attrs: MintterBlockAttrs): MintterBlock {
	return new MintterBlock(attrs.child, attrs.id)
}

export function $isMintterBlock(node: LexicalNode): boolean {
	return node instanceof MintterBlock;
}

export type MintterBlockAttrs = {
	child: any
	id: string
}