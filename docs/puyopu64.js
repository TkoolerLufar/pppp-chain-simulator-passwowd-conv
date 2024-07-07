(function() {
  'use strict';

  const CHAR_PPPP =
    'ABCDEFGHJKLMNPQRSTUVWXYZadefghijmnrty0123456789!#$%&*+-/=<>?@\\^~';
  const CHAR_PP7 =
    'あいうえおかきくけこさしすせそたちつてとなにのはひふへほまみむも' +
    'やゆよらりるろをＡＢＣＤＥＦＧＨＩＪＫＬＭＮＰＲＳＴＵＶＷＸＹＺ';

  // フォーマット
  const Format = Object.freeze({
    "PLAIN":0,
    "RLE":2,
  });

  // ルール
  const Rule = Object.freeze({
    "NORMAL":"ノーマル",
    "SUN":"ぷよぷよSUN",
    "MEGA":"でかぷよ",
    "TINY":"ちびぷよ",
  });

  // ぷよとか
  const Puyo = Object.freeze([
    "BLANK",
    "RED",
    "GREEN",
    "BLUE",
    "YELLOW",
    "PURPLE",
    "GARBAGE",
    "SUN",
  ].reduce((instance, identifier, index) => {
    instance[identifier] = index;
    return instance;
  }, {}));

  // パスワードのパースエラー
  function Puyopu64Error() {}
  Puyopu64Error.prototype = RangeError;

  /**
    * パスワードやセクステットの操作を担うクラス
    *
    * デコード時の基本思想として、簡単に直せる表記揺れは直し、
    * それ以外（ホワイトスペースなど）は無視します。
    */
  class Puyopu64 {
    /**
      * パスワードの表記揺れを統一する
      * @return {String}
      */
    normalizePassword(password) {
      return password;
    }

    /**
      * パスワードをセクステット列にデコードする
      * @return {Array}
      */
    decode(password) {
      const result = [];
      for (const ch of this.normalizePassword(password)) {
        const sextet = this.constructor.passwordChar.indexOf(ch);
        if (sextet < 0) {
          continue;
        }
        result.push(sextet);
      }
      return result;
    }

    /**
      * セクステット列をパスワードにする
      */
    encode(sextetSequence) {
      return this.normalizeSextetSequence(sextetSequence).map(
        String.prototype.charAt.bind(this.constructor.passwordChar)
      ).join('');
    }

    /**
      * セクステット列の正規化（ぷよ７のRLEに使う）
      */
    normalizeSextetSequence(sextetSequence) {
      return sextetSequence;
    }

    /**
      * 指定されたセクステットのフォーマットを取得
      */
    getFormat(sextetSequence) {
      return sextetSequence[sextetSequence.length - 1];
    }

    /**
      * あるセクステット列がフィールド何マス分の情報を保持しているか取得
      *
      * 元のフィールド面積が奇数だった場合は偶数に切り上げられます。
      */
    getCellCount(sextetSequence) {
      let size = 0;
      switch (sextetSequence[sextetSequence.length - 1]) {
        case Format.PLAIN:
          return (sextetSequence.length - 1) * 2;
        case Format.RLE:
          let size = 0;
          for (let i = 1; i < sextetSequence.length; i += 2) {
            size += sextetSequence[i] + 1;
          }
          return size * 2;
        default:
          throw new RangeError('Invalid format');
      }
    }

    /**
      * セクステット列の情報量からルールを推測する
      */
    getRuleFromCellCount(sextetSequence) {
      switch(this.getCellCount(sextetSequence)) {
        case 22:
          return Rule.MEGA;
        case 78:
          return Rule.NORMAL;
        case 84:
          return Rule.SUN;
        case 190:
          return Rule.TINY;
        default:
          throw new RangeError('Cannot recognize the original rule.');
      }
    }

    /**
      * 指定されたDOM要素にセクステットの内容に関するコメントを反映する
      *
      * 文言はもちろん、CSSクラスもいじる場合があります。
      */
    updateCommentForSextetSequence(element, sextetSequence) {
      // デフォルトでは中身を空にするだけ
      while (element.firstChild) {
        element.removeChild(element.lastChild);
      }
    }
  }

  const Puyo20thPassword = new class extends Puyopu64 {
    static passwordChar = CHAR_PP7;

    /**
      * ぷよぷよ！！のパスワード文字の表記揺れを整える
      */
    normalizePassword(password) {
      // パスワードの中の半角英字や小文字を全角英大文字に統一します。
      return password
        .replace(/[A-NPR-Z]/ig, ch =>
          String.fromCharCode(ch.charCodeAt(0) + 0xFEE0))
        .replace(/[ａ-ｎｐｒ-ｚ]/g, ch =>
          String.fromCharCode(ch.charCodeAt(0) - 0x20));
    }

    encode(sextetSequence) {
      // ホワイトスペースと改行を適当に入れる
      return super.encode(sextetSequence)
        .replace(/.{4}/g, '$& ')
        .replace(/(.{14}) /g, "$1\n");
    }

    /**
      * セクステット列の正規化（ぷよ７のRLEに使う）
      */
    normalizeSextetSequence(sextetSequence) {
      // ぷよポップのパスワードは、RLEの方が短い場合でも
      // たまにプレーンで吐き出すことがある。
      // 一方ぷよ７は再エンコしたときに元のパスワードに戻らなきゃいけない。
      // RLEにした場合の長さが〜とか65セクステット以上の繰り返しが〜とか
      // ひとつずつ解決するのはまどろっこしいので、
      // 一旦プレーンに戻してからぷよ７のやり方でRLEし直す(!)
      let plainSequence;

      try {
        switch (this.getFormat(sextetSequence)) {
          case Format.PLAIN:
            plainSequence = sextetSequence;
            break;
          case Format.RLE:
            plainSequence = [];
            for (let i = 0; i < sextetSequence.length - 2; ++i) {
              const cell = sextetSequence[i];
              for (let runLength = sextetSequence[++i] + 1; runLength--;) {
                plainSequence.push(cell);
              }
            }
            plainSequence.push(Format.PLAIN);
            break;
          default:
            return sextetSequence;
        }
      } catch(e) {
        if (e instanceof RangeError) {
          // よくわからないフォーマットの時は正規化しない
          return sextetSequence;
        }
        throw e;
      }

      // そしてRLEにしながら文字数を測る
      const rleSequence = [];
      let previousSextet = -1;
      let count;
      for (const sextet of plainSequence.slice(0, -1)) {
        if (sextet == previousSextet && count < 64) {
          ++count;
          continue;
        }
        if (previousSextet != -1) {
          // RLEで長さがプレーン以下にならなさそうならプレーンを返す
          // (最後にもう1ワード&フォーマット指定子を挿入するので長めに見積もる)
          if (rleSequence.length + 5 > plainSequence.length) {
            return plainSequence;
          }
          rleSequence.push(previousSextet);
          rleSequence.push(count - 1);
        }
        previousSextet = sextet;
        count = 1;
      }
      // 最後にもう1ワード入れる
      rleSequence.push(previousSextet);
      rleSequence.push(count - 1);
      // そしてフォーマット指定子を入れたら完成
      rleSequence.push(Format.RLE);
      // 最後までプレーン以下の長さを保持しながら処理できたらRLE版を返す
      return rleSequence;
    }
  }();

  const PpppPassword = new class extends Puyopu64 {
    static passwordChar = CHAR_PPPP;

    /**
      * ぷよぷよパズルポップのパスワード文字の表記揺れを整える
      */
    normalizePassword(password) {
      // パスワードの中の全角英数字を半角にします。
      // また、 Shift+^ が半角はチルダで全角は波ダッシュになる環境があるので、
      // ついでに波ダッシュも半角チルダに変換します。
      return password
        .replace(
          /[！＃-＆＊＋－／-９＜-ＨＪ-ＮＰ-Ｚ＼＾ａｄ-ｊｍｎｒｔｙ\uff5e]/g,
          ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
        )
        .replaceAll("\u301C", '~');
    }
  }();

  /**
    * 指定されたパスワードに対応するデコーダーを取得します。
    */
  function getPasswordDecoder(password) {
    let isNotForPuyo20th = false, isNotForPppp = false;

    for (let i = password.length - 1; i >= 0; --i) {
      const ch = password.charAt(i);

      if (!isNotForPuyo20th) {
        const sextetOnPuyo20th =
          Puyo20thPassword.decode(ch)[0];
        if (sextetOnPuyo20th !== undefined) {
          if ([0, 2].includes(sextetOnPuyo20th)) {
            return Puyo20thPassword;
          }
          isNotForPuyo20th = true;
        }
      }

      if (!isNotForPppp) {
        const sextetOnPppp = PpppPassword.decode(ch)[0];
        if (sextetOnPppp !== undefined) {
          if ([0, 2].includes(sextetOnPppp)) {
            return PpppPassword;
          }
          isNotForPppp = true;
        }
      }

      if (isNotForPuyo20th && isNotForPppp) {
        return null;
      }
    }
    return null;
  }

  function isPasswordPuyo7Compatible(password) {
    for (const i = password.length - 1; i >= 0; --i) {
      const ch = password.charAt(i);
      const sextet = CHAR_PP7.indexOf(ch);
    }
  }

  // 入力に応じて変換前と変換後のバージョンを推測する
  document.getElementById('originalPassword').addEventListener('input', e => {
    const sourceTextNode = document.getElementById('originalVersion');
    const targetTextNode = document.getElementById('anotherVersion');
    try {
      const decoder = getPasswordDecoder(e.target.value);
      if (!decoder) {
        throw new RangeError();
      }
      const sextet = decoder.decode(e.target.value);
      const rule = decoder.getRuleFromCellCount(sextet);
      if (decoder === Puyo20thPassword) {
        if (rule == Rule.SUN) {
          sourceTextNode.textContent = 'ぷよぷよ！！';
        } else {
          sourceTextNode.textContent = 'ぷよぷよ７、ぷよぷよ！！';
        }
        targetTextNode.textContent = 'ぷよぷよパズルポップ';
      } else if (decoder === PpppPassword) {
        sourceTextNode.textContent = 'ぷよぷよパズルポップ';
        if (rule == Rule.SUN) {
          targetTextNode.textContent = 'ぷよぷよ！！';
        } else {
          targetTextNode.textContent = 'ぷよぷよ７、ぷよぷよ！！';
        }
      } else {
        throw new RangeError();
      }
    } catch (e) {
      if (!(e instanceof RangeError)) {
        throw e;
      }
      sourceTextNode.textContent = '元';
      targetTextNode.textContent = '翻訳後';
    }
  });

  // 翻訳ボタンが押されたら変換する
  function transpilePassword(password) {
    const resultNode = document.getElementById('anotherPassword');
    try {
      const Decoder = getPasswordDecoder(password);
      const Encoder =
        Decoder === Puyo20thPassword ? PpppPassword : (
        Decoder === PpppPassword ? Puyo20thPassword :
        null);
      if (Encoder === null) {
        throw new RangeError('パスワードが まちがっているようです。');
      }

      const sextet = Decoder.decode(password);
      resultNode.value = Encoder.encode(sextet);
    } catch (e) {
      if (!(e instanceof RangeError)) {
        console.error(e);
      }
      resultNode.value = "エラー:\n" + e.message;
    }
  }
  document.getElementById('puyopu64').addEventListener('submit', e => {
    e.preventDefault();
    transpilePassword(e.target.originalPassword.value);
  });
})();
