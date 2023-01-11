import {$getRoot, createEditor} from 'lexical';
import {$createMintterBlock, MintterBlock} from './MintterBlock';
import moment from "moment";
import {dev, z} from "@autoplay/utils";
import xss from "xss";
import {defineItemSchema} from "./defineItemSchema";
import {defineMimeType} from "./MimeType";
import {textHTML} from "./textHTML.mimeType";

const decimalNumberFormat = defineMimeType("number/decimal", {
  parse(input) {
    const num = typeof input === "number" ? input : Number(input);
    if (isNaN(num))
      throw dev`Unknown kind is not a number: \`${input}\``.asError();
    return num;
  },
});

const naturalNumberFormat = defineMimeType("number/natural", {
  parse(input) {
    const num = decimalNumberFormat.parser.parse(input);
    if (num < 0)
      throw dev`Number (\`${num}\`) cannot be natural if it's negative.`.asError();

    return num;
  },
});

const itemIDFormat = defineMimeType(
  "mintter/item-id",
  z.string({description: "Mintter Item ID"}).min(6)
);

// Uhhh... Like a pub key attached to an authorized identity
const agentIdentityFormat = defineMimeType(
  "mintter/signer",
  z.string({description: "Mintter Signing Identity"}).min(6)
);

const unixSecsFormat = defineMimeType("time/unix-secs", {
  parse(input) {
    const num = naturalNumberFormat.parser.parse(input);
    return num;
  },
});

export const PageWithTitle = defineItemSchema({
  values: {
    title: {
      format: textHTML,
    },
  },
  slots: {
    // slot is named "children"
    children: {
      multiple: true,
      itemStandoffValues: {
        values: {
          fractionalIndex: {
            format: decimalNumberFormat,
          },
          indentation: {
            format: naturalNumberFormat,
          },
        },
      },
    },
    /**
     * slot is named "comments" and will be positioned next to
     * the page. Because this is a slot, the actual comment ui
     * is agnostic of this hierarchy block.
     *
     * In fact, you could technically mix comment formats together
     * such as using an image block ui as a comment.
     */
    comments: {
      multiple: true,
      itemStandoffValues: {
        values: {
          postedAt: {
            format: unixSecsFormat,
          },
          postedBy: {
            format: agentIdentityFormat,
          },
          /** the subject of this comment (e.g. a block on the page) */
          targetId: {
            format: itemIDFormat,
          },
        },
      },
    },
  },
});

export const ProseMirrorBlockContainerHTML = PageWithTitle.forHTML(
  ({slots, values}) => {
    slots.comments.map((child) => child.html);
    return {
      css: `
.page-content { padding: 8px 0; }
.page-block { position: relative; white-space: normal; padding-left: 1rem; transition: all 0.2s;  }
.page-title { font-size: 36px; font-weight: bold; letter-spacing: -0.01pt; margin-bottom: 1rem; }
.comment-group { padding: 0.2rem; border: 1px solid #ddd }
.page-comment--meta { font-size: .85em; }
.reply-comment-list::before { content: "↪︎"; position: absolute; left: 1rem }
.reply-comment-list { padding-left: 1rem; }
`,
      // Absolute: .page-block-comment { position: absolute; top: 0px; right: 0px; z-index: 1; background: white }
      html: `
<div class="page-title">${xss(values.title["text/html"])}</div>
<div class="page-content">
  ${slots.children
        .map(
          (a) =>
              `
<div class="page-block" style="margin-left: ${a.standoffValues.indentation["number/natural"] + "rem"
              }" data-miid="${xss(
                /* hmm not an attr escape... */
                a.miid
              )}">
  <style>${a.css}</style>
  ${a.html}
  ${wrapCommentsHTML({
    class: "page-block-comment",
    comments: slots.comments
      .filter(
        (comment) =>
          comment.standoffValues.targetId["mintter/item-id"] === a.miid
      )
      .map((comment) => renderCommentHTML(comment, slots.comments)),
  })}
</div>`
      )
        .join("")}
  <div>
</div>
`,
    };
  }
);

function renderCommentHTML(
  comment: typeof PageWithTitle["_slotHTMLTypes"]["comments"][0],
  allComments: typeof PageWithTitle["_slotHTMLTypes"]["comments"]
  // // prevent recursive loop, maybe?
  // parents: string[],
): string {
  const signer = comment.standoffValues.postedBy["mintter/signer"];
  return `
<div class="page-comment" data-miid="${xss(
    /* hmm not an attr escape... */
    comment.miid
  )}">
  <style>${comment.css}</style>
  <div class="page-comment--body" data-mount-target>${comment.html}</div>
  <div class="page-comment--meta">
  <byline class="page-comment--poster">${signer.split(":")[1] ?? signer
    }</byline>&nbsp;
  <time class="page-comment--time">${moment(
    comment.standoffValues.postedAt["time/unix-secs"] * 1000
  ).fromNow()}</time>
  </div>
  ${
    // insert comment replies
    wrapCommentsHTML({
      class: "reply-comment-list",
      comments: allComments
        .filter(
          (nested) =>
            nested.miid !== comment.miid &&
            nested.standoffValues.targetId["mintter/item-id"] === comment.miid
        )
        .map((reply) => renderCommentHTML(reply, allComments)),
    })
    }
</div>`;
}

function wrapCommentsHTML(props: {
  class?: string;
  comments: string[];
}): string {
  if (props.comments.length > 0) {
    return `<div class="${props.class} comment-group">${props.comments.join(
      ""
    )}</div>`;
  }
  return "";
}

export const ProseMirrorBlockContainerWeb = PageWithTitle.forWeb(
  ({slots, values, save}) => {


    function createMintterEditor(container: HTMLElement) {
      const editorConfig = {
        namespace: 'MintterEditorContainer',
        theme: {
        },
        onError: console.error,
        nodes: [
          MintterBlock
        ],
      };

      const editor = createEditor(editorConfig);

      editor.update(() => {
        let root = $getRoot()

        slots.children.forEach(child => {
          root.append($createMintterBlock({child, id: child.miid}))
        })
      })

      // let removeListener = mergeRegister(
      //   editor.registerCommand(INDENT_CONTENT_COMMAND, () => {
      //     return false
      //   }, COMMAND_PRIORITY_EDITOR)
      // )

      // editor.registerNodeTransform(MintterBlock, mintterBlockTransform)


      let editorRoot = document.createElement('div')
      editorRoot.id = 'editor-root'

      editor.setRootElement(editorRoot)
      container.append(editorRoot)

      return editorRoot

    }

    return {
      apply(values) {
        console.log('IMPLEMENT apply()', values)
      },
      mount({container}) {

        let instance = createMintterEditor(container)
        return {
          destroy() {
            instance.remove()
          },
        }
      }
    }
  }
);