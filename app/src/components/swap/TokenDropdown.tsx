import React, { useState, useEffect } from "react";
import { Dropdown } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { bindActionCreators } from "redux";
import * as swapActions from "../../state/swap/actions";
import { selectSwap } from "../../state";
import { TokenType } from "../../contracts";
import styles from "./SwapInterface.module.css";
import Image from "next/image";

const DefaultText: React.FC = () => {
  return (
    <>
      Select <br /> Token
    </>
  );
};

const TokenText: React.FC<{ token: TokenType }> = ({ token }) => {
  const imgUrl = `/${token.toLowerCase()}.png`;
  return (
    <div className={styles.dropdownText}>
      <Image src={imgUrl} alt={token} width={30} height={30} />
      &nbsp;&nbsp;{token.toUpperCase()}
    </div>
  );
};

const TokenDropdown = (): JSX.Element => {
  const { tokenType } = useSelector(selectSwap)
  const { setTokenType } = bindActionCreators(swapActions, useDispatch());

  const tokens: Array<TokenType> = ["Dai", "Link", "Uni"];

  const [dropdownBtnText, setDropdownText] = useState<JSX.Element>(
    <DefaultText />
  );

  useEffect(() => {
    if(tokenType !== undefined){
      setDropdownText(<TokenText token={tokenType} />);
    }
  }, [])

  const handleSelect = (e: string | null): void => {
    if(e === "Dai" || e === "Link" || e === "Uni"){
      setDropdownText(<TokenText token={e} />);
      setTokenType(e);
    }
  };

  return (
    <Dropdown onSelect={handleSelect}>
      <Dropdown.Toggle
        variant="outline-secondary"
        className={styles.dropdownBtn}
        bsPrefix="p-0"
      >
        {dropdownBtnText}
      </Dropdown.Toggle>

      <Dropdown.Menu className={styles.dropdownMenu}>
        {tokens.map((token) => (
          <Dropdown.Item
            eventKey={token}
            key={token}
            className={styles.dropdownItem}
          >
            <TokenText token={token} />
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default TokenDropdown;
