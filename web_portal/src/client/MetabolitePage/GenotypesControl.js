import Check from '@fortawesome/fontawesome-free/svgs/solid/check.svg'
import { darken, hideVisually, transparentize } from 'polished'
import PropTypes from 'prop-types'
import React from 'react'
import styled from 'styled-components'

const categories = ['includeWT', 'includePKD1_Mutant'] //, 'includeDKO'

//#5da4d6
//#ff8f0e
//#2ca064

const categoryColors = {
  includePKD1_Mutant: '#5DA4D6',
  // includeDKO: '#FF8F0E',
  includeWT: '#2CA064'
}

const categoryLabels = {
  includePKD1_Mutant: 'Pkd1_Mutant',
  // includeDKO: 'Pkd1_Kif3a_KO',
  includeWT: 'Normal'
}

// The max-width styles here are based on the filter settings
// layout in the gnomAD browser.

const GenotypesControlWrapper = styled.div`
  @media (max-width: 700px) {
    display: flex;
    flex-direction: column;
    width: fit-content;
  }
`

const Button = styled.button`
  box-sizing: border-box;
  width: 35px;
  height: 20px;
  padding: 0;
  border: 1px solid #ddd;
  border-radius: 5px;
  margin-right: 0.75em;
  background: none;
  cursor: pointer;
  user-select: none;
  line-height: 18px;
  outline: none;

  &:active,
  &:hover {
    border-color: ${darken(0.15, '#ddd')};
  }

  &:focus {
    box-shadow: 0 0 0 0.2em ${transparentize(0.5, '#ddd')};
  }

  ::-moz-focus-inner {
    border: 0;
  }
`

const CheckboxIcon = styled.span`
  display: inline-block;
  box-sizing: border-box;
  width: 14px;
  height: 14px;
  padding: 1px;
  border-width: 1px;
  margin: 0 0.7em;
  border-color: #000;
  border-radius: 3px;
  border-style: solid;
  font-size: 10px;
`

const Checkbox = styled.input.attrs({ type: 'checkbox' })`
  ${hideVisually()};

  :focus + ${CheckboxIcon} {
    border-color: #428bca;
    box-shadow: 0 0 0 0.2em #428bca;
  }
`

const CategoryWrapper = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  overflow: hidden;
  border-color: ${props => props.borderColor};
  border-style: solid;
  border-width: 1px;

  &:first-child {
    border-top-left-radius: 0.5em;
    border-bottom-left-radius: 0.5em;
  }

  &:last-child {
    border-top-right-radius: 0.5em;
    border-bottom-right-radius: 0.5em;
  }

  @media (max-width: 700px) {
    margin-bottom: 0.25em;
    border-radius: 0.5em;
  }
`

const labelBackground = ({ backgroundColor }) =>
  `linear-gradient(to right, ${backgroundColor}, ${backgroundColor} 2em, rgba(0, 0, 0, 0) 2em, rgba(0, 0, 0, 0))`

const Label = styled.label`
  display: inline-flex;
  flex-grow: 1;
  align-items: center;
  background: ${labelBackground};
  background-repeat: no-repeat;
  font-size: 14px;
  user-select: none;
`

const LabelText = styled.span`
  padding: 0.375em 0.75em;
`

export const GenotypesControl = ({ categorySelections, id, onChange }) => (
  <GenotypesControlWrapper>
    {categories.map(category => (
      <CategoryWrapper key={category} borderColor={categoryColors[category]}>
        <Label
          htmlFor={`${id}-${category}`}
          backgroundColor={transparentize(0.5, categoryColors[category])}
        >
          <Checkbox
            checked={categorySelections[category]}
            id={`${id}-${category}`}
            type="checkbox"
            onChange={e => onChange({[category]: e.target.checked })}
          />
          <CheckboxIcon aria-hidden>{categorySelections[category] && <Check />}</CheckboxIcon>
          <LabelText>{categoryLabels[category]}</LabelText>
        </Label>
        <Button
          onClick={() =>
            onChange({
              includePKD1_Mutant: false,
              // includeDKO: false,
              includeWT: false,
              [category]: true,
            })
          }
        >
          only
        </Button>
      </CategoryWrapper>
    ))}
  </GenotypesControlWrapper>
)

GenotypesControl.propTypes = {
  categorySelections: PropTypes.shape({
    PKD1_Mutant: PropTypes.bool.isRequired,
    // DKO: PropTypes.bool.isRequired,
    WT: PropTypes.bool.isRequired,
  }).isRequired,
  id: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
}
